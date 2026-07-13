import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { enrichContactByName, resolveWebsite } from "@/lib/decision-makers";
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
const TIME_BUDGET_MS = 40_000;

const bodySchema = z.object({
  batchSize: z.number().int().min(1).max(20).default(10),
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
    include: { account: { select: { id: true, companyName: true, website: true } } },
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

  // Cache website resolution + scrape per account within the batch.
  const siteCache = new Map<string, { website: string | null; site: ScrapedSite | null }>();

  for (const contact of contacts) {
    if (Date.now() - startedAt > TIME_BUDGET_MS && processedThrough) break;

    let cached = siteCache.get(contact.account.id);
    if (!cached) {
      let website = contact.account.website;
      if (!website && process.env.SERPER_API_KEY) {
        try {
          website = await resolveWebsite(contact.account.companyName);
          if (website) {
            await db.account.update({ where: { id: contact.account.id }, data: { website } });
          }
        } catch {
          website = null;
        }
      }
      const site = website ? await scrapeSiteForContacts(website) : null;
      cached = { website, site };
      siteCache.set(contact.account.id, cached);
    }

    let email: string | null = null;
    let source: string | null = null;
    try {
      const match = await enrichContactByName(
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
      );

      if (match && (match.email || (!contact.phone && match.phone) || (!contact.linkedinUrl && match.linkedinUrl))) {
        await db.contact.update({
          where: { id: contact.id },
          data: {
            email: match.email ?? undefined,
            phone: contact.phone ?? match.phone ?? undefined,
            linkedinUrl: contact.linkedinUrl ?? match.linkedinUrl ?? undefined,
            title: contact.title ?? match.title ?? undefined,
            confidenceScore: Math.max(contact.confidenceScore ?? 0, match.confidenceScore),
            source: match.source,
            lastVerifiedAt: new Date(),
          },
        });
        if (match.email) {
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
    processedThrough = contact.id;
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
