import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { lookupDecisionMakers, enrichContactByName, resolveWebsite } from "@/lib/decision-makers";
import { lookupPlace } from "@/lib/places";
import { saveDiscoveredContacts } from "@/lib/save-contacts";
import { parseDomain } from "@/lib/text";
import { scrapeSiteForContacts } from "@/lib/web-contact-scraper";
import { NextRequest } from "next/server";

// Multi-tier enrichment across up to 10 contacts plus company-level
// discovery can exceed Vercel's default function timeout.
export const maxDuration = 60;

// How many existing contacts (missing email/phone) to enrich per click.
// The free website scrape covers all of them at no cost; this cap bounds
// the Hunter/Apollo/PDL fallback calls (time + credits).
const MAX_CONTACT_MATCHES = 10;

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId : null;

  if (!accountId) {
    return Response.json({ error: "accountId is required" }, { status: 400 });
  }

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      companyName: true,
      website: true,
      phone: true,
      city: true,
      state: true,
      contacts: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          email: true,
          phone: true,
          linkedinUrl: true,
          title: true,
          department: true,
          confidenceScore: true,
        },
      },
    },
  });

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  // -----------------------------------------------------------------------
  // Phase 0: Make sure we have a website — the free enrichment tier
  // (site scraping) and Hunter both depend on the domain. Registry-imported
  // facilities usually arrive without one.
  // -----------------------------------------------------------------------
  let website = account.website;
  if (!website && process.env.SERPER_API_KEY) {
    try {
      website = await resolveWebsite(account.companyName);
      if (website) {
        await db.account.update({ where: { id: account.id }, data: { website } });
      }
    } catch {
      website = null;
    }
  }
  const domain = parseDomain(website);

  let added = 0;
  let updated = 0;
  const providersUsed = new Set<string>();

  // -----------------------------------------------------------------------
  // Phase 1: Per-contact enrichment for existing contacts missing email or
  // phone. Free-first: the facility's own website is scraped ONCE here and
  // reused for every contact; Hunter runs next; Apollo/PDL are backups.
  // -----------------------------------------------------------------------
  const contactsNeedingEnrichment = account.contacts
    .filter((c) => !c.email || !c.phone)
    .slice(0, MAX_CONTACT_MATCHES);

  const scrapedSite =
    website && contactsNeedingEnrichment.length ? await scrapeSiteForContacts(website) : null;
  if (scrapedSite) providersUsed.add("website");

  // Facility main line — the guaranteed fallback channel. Looked up once per
  // account (Google Business via Serper Places) and reused for every contact
  // the cascade couldn't find a direct phone for.
  let mainLinePhone = account.phone;
  if (!mainLinePhone && contactsNeedingEnrichment.length) {
    const place = await lookupPlace(account.companyName, {
      city: account.city,
      state: account.state,
      domain,
    });
    if (place?.phone) {
      mainLinePhone = place.phone;
      providersUsed.add("google_places");
      await db.account.update({
        where: { id: account.id },
        data: { phone: place.phone, website: website ?? place.website ?? undefined },
      });
    }
  }

  for (const contact of contactsNeedingEnrichment) {
    const match = await enrichContactByName(
      {
        firstName: contact.firstName,
        lastName: contact.lastName,
        fullName: contact.fullName,
        organizationName: account.companyName,
        domain,
        website,
        linkedinUrl: contact.linkedinUrl,
      },
      { scrapedSite },
    );

    const directPhone = match?.phone ?? null;
    const bestPhone = directPhone ?? mainLinePhone;

    const hasNewData =
      (!contact.email && match?.email) ||
      (!contact.phone && bestPhone) ||
      (!contact.linkedinUrl && match?.linkedinUrl);

    if (hasNewData) {
      await db.contact.update({
        where: { id: contact.id },
        data: {
          email: contact.email ?? match?.email ?? undefined,
          emailStatus: contact.email ? undefined : (match?.email ? match.emailStatus : undefined),
          phone: contact.phone ?? bestPhone ?? undefined,
          phoneType: contact.phone
            ? undefined
            : (directPhone ? (match?.phoneType ?? "direct") : (bestPhone ? "main_line" : undefined)),
          linkedinUrl: contact.linkedinUrl ?? match?.linkedinUrl ?? undefined,
          title: contact.title ?? match?.title ?? undefined,
          firstName: contact.firstName ?? match?.firstName ?? undefined,
          lastName: contact.lastName ?? match?.lastName ?? undefined,
          confidenceScore: Math.max(contact.confidenceScore ?? 0, match?.confidenceScore ?? 0),
          source: match?.source ?? undefined,
          lastVerifiedAt: match ? new Date() : undefined,
        },
      });
      updated++;
      match?.sourcesUsed.forEach((s) => providersUsed.add(s));
    }
  }

  // -----------------------------------------------------------------------
  // Phase 2: Company-level discovery — find NEW people at this company
  // that are not yet in our contacts list.
  // -----------------------------------------------------------------------
  let discoveryError: string | null = null;
  try {
    const { contacts: discovered, resolvedWebsite, providersUsed: usedProviders } =
      await lookupDecisionMakers({
        companyName: account.companyName,
        website,
      });

    usedProviders.forEach((p) => providersUsed.add(p));

    const saved = await saveDiscoveredContacts(account.id, discovered, { updateExisting: true });
    added += saved.created;
    updated += saved.updated;

    // Update account website if resolved
    if (resolvedWebsite && !website) {
      await db.account.update({
        where: { id: account.id },
        data: { website: resolvedWebsite },
      });
    }
  } catch (error) {
    // Phase 2 is non-fatal — Phase 1 results are already saved — but the
    // failure should be visible to the caller, not silently swallowed.
    discoveryError = error instanceof Error ? error.message : "Company-level discovery failed";
    console.error(`Company-level discovery failed for ${account.companyName}:`, discoveryError);
  }

  // Be honest when the button had nothing to work with.
  let note: string | null = null;
  const anyPaidProvider =
    !!process.env.HUNTER_API_KEY ||
    !!process.env.SERPER_API_KEY ||
    (!!process.env.APOLLO_API_KEY && process.env.APOLLO_PLAN_ENABLED === "true") ||
    !!process.env.PDL_API_KEY;
  if (!website && !anyPaidProvider) {
    note =
      "No enrichment sources available: this account has no website to scrape and no provider API keys (SERPER, HUNTER, APOLLO, PDL) are configured — see /crm/settings.";
  } else if (!website && !process.env.SERPER_API_KEY) {
    note =
      "This account has no website, so the free website scrape was skipped. Add the website to the account (or set SERPER_API_KEY so it can be found automatically).";
  }

  return Response.json({
    data: {
      accountId: account.id,
      companyName: account.companyName,
      contactsAdded: added,
      contactsUpdated: updated,
      totalProcessed: contactsNeedingEnrichment.length,
      totalContacts: account.contacts.length,
      providersUsed: [...providersUsed],
      discoveryError,
      note,
    },
    message: `Enrichment complete: ${updated} contacts updated with email/phone, ${added} new contacts found for ${account.companyName}.${discoveryError ? ` Note: company-level discovery failed (${discoveryError}).` : ""}`,
  });
}
