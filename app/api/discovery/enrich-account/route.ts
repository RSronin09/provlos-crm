import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { lookupDecisionMakers, enrichContactByName } from "@/lib/decision-makers";
import { saveDiscoveredContacts } from "@/lib/save-contacts";
import { parseDomain } from "@/lib/text";
import { NextRequest } from "next/server";

// How many existing contacts (with no email) to attempt Apollo person-match on.
// Each costs 1 Apollo credit.
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

  const domain = parseDomain(account.website);

  let added = 0;
  let updated = 0;
  const providersUsed = new Set<string>();

  // -----------------------------------------------------------------------
  // Phase 1: Per-contact Apollo people/match for existing contacts
  // that are missing email or phone. This is the most targeted approach
  // and directly resolves "No email | No phone" on known contacts.
  // -----------------------------------------------------------------------
  const contactsNeedingEnrichment = account.contacts
    .filter((c) => !c.email || !c.phone)
    .slice(0, MAX_CONTACT_MATCHES);

  for (const contact of contactsNeedingEnrichment) {
    const match = await enrichContactByName({
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: contact.fullName,
      organizationName: account.companyName,
      domain,
      linkedinUrl: contact.linkedinUrl,
    });

    if (!match) continue;

    const hasNewData =
      (!contact.email && match.email) ||
      (!contact.phone && match.phone) ||
      (!contact.linkedinUrl && match.linkedinUrl);

    if (hasNewData) {
      await db.contact.update({
        where: { id: contact.id },
        data: {
          email: contact.email ?? match.email ?? undefined,
          phone: contact.phone ?? match.phone ?? undefined,
          linkedinUrl: contact.linkedinUrl ?? match.linkedinUrl ?? undefined,
          title: contact.title ?? match.title ?? undefined,
          firstName: contact.firstName ?? match.firstName ?? undefined,
          lastName: contact.lastName ?? match.lastName ?? undefined,
          confidenceScore: Math.max(contact.confidenceScore ?? 0, match.confidenceScore),
          source: "apollo_enriched",
          lastVerifiedAt: new Date(),
        },
      });
      updated++;
      providersUsed.add("apollo");
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
        website: account.website,
      });

    usedProviders.forEach((p) => providersUsed.add(p));

    const saved = await saveDiscoveredContacts(account.id, discovered, { updateExisting: true });
    added += saved.created;
    updated += saved.updated;

    // Update account website if resolved
    if (resolvedWebsite && !account.website) {
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

  return Response.json({
    data: {
      accountId: account.id,
      companyName: account.companyName,
      contactsAdded: added,
      contactsUpdated: updated,
      totalProcessed: contactsNeedingEnrichment.length,
      providersUsed: [...providersUsed],
      discoveryError,
    },
    message: `Enrichment complete: ${updated} contacts updated with email/phone, ${added} new contacts found for ${account.companyName}.${discoveryError ? ` Note: company-level discovery failed (${discoveryError}).` : ""}`,
  });
}
