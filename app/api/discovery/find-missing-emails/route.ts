import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { enrichContactByName } from "@/lib/decision-makers";
import { lookupPlace } from "@/lib/places";
import { parseDomain } from "@/lib/text";
import { scrapeSiteForContacts, type ScrapedSite } from "@/lib/web-contact-scraper";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

// Allow the full minute on Vercel — each contact can take several seconds
// when multiple cascade tiers run.
export const maxDuration = 60;

// Stop picking up new contacts after this much wall time and hand the caller
// a cursor instead, so the UI can loop batch after batch without timeouts.
// Set conservatively: the budget is checked BEFORE a chunk starts, so the
// real ceiling is TIME_BUDGET_MS + one chunk's worst-case duration
// (~PER_CONTACT_TIMEOUT_MS, since a chunk's contacts run concurrently) —
// that sum must stay under maxDuration with real margin.
const TIME_BUDGET_MS = 15_000;

// Hard per-contact ceiling — one slow facility site or a hung provider call
// must not burn the whole invocation. A contact that exceeds this simply
// stays unenriched (the per-contact Enrich button can retry it later).
// Measured against production: batchSize=20 (4 chunks) reliably hit
// FUNCTION_INVOCATION_TIMEOUT at 60s; batchSize=5 (1 chunk) reliably
// finished in ~10s. Kept low so TIME_BUDGET_MS + this stays well under 60s.
const PER_CONTACT_TIMEOUT_MS = 12_000;

const bodySchema = z.object({
  // Hard-capped at 10 — batchSize=20 measured to reliably exceed Vercel's
  // 60s function limit (FUNCTION_INVOCATION_TIMEOUT) in production.
  batchSize: z.number().int().min(1).max(10).default(5),
  // Loose UUID shape — zod's .uuid() enforces RFC version/variant bits,
  // which rejects some otherwise-valid stored ids.
  cursor: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .optional(),
});

// Batch email-finder: walks every contact that has a name but no email and
// runs the free-first enrichment cascade on each. Contacts are processed
// grouped by account so each facility's website is scraped only once.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const whereMissingEmail: Prisma.ContactWhereInput = {
    email: null,
    isDoNotContact: false,
    isUnverifiedIdentity: false,
    OR: [{ fullName: { not: null } }, { AND: [{ firstName: { not: null } }, { lastName: { not: null } }] }],
  };

  const totalMissing = await db.contact.count({ where: whereMissingEmail });

  // `id > cursor` pagination rather than Prisma's cursor API: processed
  // contacts gain emails and drop out of the filter, and a cursor anchored
  // on a row that no longer matches the filter returns nothing.
  const contacts = await db.contact.findMany({
    where: parsed.data.cursor
      ? { AND: [whereMissingEmail, { id: { gt: parsed.data.cursor } }] }
      : whereMissingEmail,
    orderBy: { id: "asc" },
    take: parsed.data.batchSize,
    include: {
      account: {
        select: { id: true, companyName: true, website: true, phone: true, city: true, state: true },
      },
    },
  });

  if (!contacts.length) {
    return Response.json({
      data: { processed: 0, found: 0, results: [], nextCursor: null, totalMissing },
      message: "No contacts left that are missing an email.",
    });
  }

  const startedAt = Date.now();
  const results: {
    contactId: string;
    name: string | null;
    company: string;
    email: string | null;
    source: string | null;
  }[] = [];
  let found = 0;
  let processedThrough: string | null = null;

  // ---- Stage 1: per account (once, in parallel): resolve + scrape the
  // website, and secure the facility's main phone line as the guaranteed
  // fallback channel for contacts the cascade can't find a direct phone for.
  // Hard ceiling for the whole prep stage: with 20 contacts across 20 slow
  // facility sites, uncapped prep alone can blow past the platform's 60s
  // function limit. Accounts not prepped in time fall back to their stored
  // website/phone and skip the scrape.
  const STAGE1_BUDGET_MS = 15_000;

  const siteCache = new Map<
    string,
    { website: string | null; site: ScrapedSite | null; mainLinePhone: string | null }
  >();
  const accountIds = [...new Set(contacts.map((c) => c.account.id))];
  const stage1 = Promise.all(
    accountIds.map(async (accountId) => {
      const account = contacts.find((c) => c.account.id === accountId)!.account;
      let website = account.website;
      let mainLinePhone = account.phone;

      // One name-matched Google Business lookup covers both gaps: the
      // website (identity-proven — never a blind first-Google-hit, which
      // caused the domain-poisoning incidents) and the main-line phone.
      if (!website || !mainLinePhone) {
        try {
          const place = await lookupPlace(account.companyName, {
            city: account.city,
            state: account.state,
            domain: parseDomain(website),
          });
          if (place && (place.website || place.phone)) {
            website = website ?? place.website;
            mainLinePhone = mainLinePhone ?? place.phone;
            await db.account.update({
              where: { id: accountId },
              data: {
                website: website ?? undefined,
                phone: mainLinePhone ?? undefined,
              },
            });
          }
        } catch {
          // keep whatever the account already had
        }
      }

      const site = website ? await scrapeSiteForContacts(website) : null;
      siteCache.set(accountId, { website, site, mainLinePhone });
    }),
  );
  await Promise.race([stage1, new Promise((resolve) => setTimeout(resolve, STAGE1_BUDGET_MS))]);
  // Accounts that missed the prep window still get their stored data.
  for (const contact of contacts) {
    if (!siteCache.has(contact.account.id)) {
      siteCache.set(contact.account.id, {
        website: contact.account.website,
        site: null,
        mainLinePhone: contact.account.phone,
      });
    }
  }

  // ---- Stage 2: enrich contacts in parallel chunks. Concurrency is capped
  // so provider APIs (Serper/Hunter/Instantly) aren't hammered, and the time
  // budget is checked between chunks so we return a cursor instead of letting
  // the serverless runtime kill the invocation mid-write.
  const CONCURRENCY = 3;

  const enrichOne = async (contact: (typeof contacts)[number]) => {
    const cached =
      siteCache.get(contact.account.id) ?? { website: null, site: null, mainLinePhone: null };
    let email: string | null = null;
    let source: string | null = null;
    try {
      const match = await Promise.race([
        enrichContactByName(
          {
            firstName: contact.firstName,
            lastName: contact.lastName,
            fullName: contact.fullName,
            organizationName: contact.account.companyName,
            domain: parseDomain(cached.website),
            website: cached.website,
            linkedinUrl: contact.linkedinUrl,
          },
          { scrapedSite: cached.site },
        ),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), PER_CONTACT_TIMEOUT_MS)),
      ]);

      const directPhone = match?.phone ?? null;
      const bestPhone = directPhone ?? cached.mainLinePhone;
      const hasNewData =
        (match && (match.email || (!contact.linkedinUrl && match.linkedinUrl))) ||
        (!contact.phone && bestPhone);

      if (hasNewData) {
        await db.contact.update({
          where: { id: contact.id },
          data: {
            email: match?.email ?? undefined,
            emailStatus: match?.email ? match.emailStatus : undefined,
            phone: contact.phone ?? bestPhone ?? undefined,
            phoneType: contact.phone
              ? undefined
              : (directPhone ? (match?.phoneType ?? "direct") : (bestPhone ? "main_line" : undefined)),
            linkedinUrl: contact.linkedinUrl ?? match?.linkedinUrl ?? undefined,
            title: contact.title ?? match?.title ?? undefined,
            confidenceScore: Math.max(contact.confidenceScore ?? 0, match?.confidenceScore ?? 0),
            source: match?.source ?? undefined,
            lastVerifiedAt: match ? new Date() : undefined,
          },
        });
        if (match?.email) {
          email = match.email;
          source = match.source;
          found++;
        }
      }
    } catch (error) {
      console.error(
        `Batch email enrichment failed for contact ${contact.id}:`,
        error instanceof Error ? error.message : error,
      );
    }

    results.push({
      contactId: contact.id,
      name: contact.fullName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      company: contact.account.companyName,
      email,
      source,
    });
  };

  for (let i = 0; i < contacts.length; i += CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS && processedThrough) break;
    const chunk = contacts.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(enrichOne));
    processedThrough = chunk[chunk.length - 1].id;
  }

  const processed = results.length;
  const moreInBatchWindow = processed === contacts.length && contacts.length === parsed.data.batchSize;
  const stoppedEarly = processed < contacts.length;
  const nextCursor = moreInBatchWindow || stoppedEarly ? processedThrough : null;

  return Response.json({
    data: {
      processed,
      found,
      results,
      nextCursor,
      totalMissing,
    },
    message: `Processed ${processed} contact(s), found ${found} email(s).`,
  });
}
