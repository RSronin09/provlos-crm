import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { lookupDecisionMakers, enrichContactByName } from "@/lib/decision-makers";
import { NextRequest } from "next/server";

// How many existing contacts (with no email) to attempt Apollo person-match on.
// Each costs 1 Apollo credit.
const MAX_CONTACT_MATCHES = 10;

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json();
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

  const domain = account.website
    ? (() => {
        try {
          const url = account.website.startsWith("http")
            ? account.website
            : `https://${account.website}`;
          return new URL(url).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      })()
    : null;

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
  try {
    const { contacts: discovered, resolvedWebsite, providersUsed: usedProviders } =
      await lookupDecisionMakers({
        companyName: account.companyName,
        website: account.website,
      });

    usedProviders.forEach((p) => providersUsed.add(p));

    const existingEmails = new Set(
      account.contacts.map((c) => c.email?.toLowerCase()).filter(Boolean),
    );
    const existingNames = new Set(
      account.contacts.map((c) => c.fullName?.toLowerCase()).filter(Boolean),
    );

    for (const contact of discovered) {
      const fullName =
        contact.fullName ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      if (!fullName) continue;

      // Skip if we already have this person (by email or name)
      if (contact.email && existingEmails.has(contact.email.toLowerCase())) continue;
      if (existingNames.has(fullName.toLowerCase())) continue;

      await db.contact.create({
        data: {
          accountId: account.id,
          fullName,
          firstName: contact.firstName ?? undefined,
          lastName: contact.lastName ?? undefined,
          title: contact.title ?? undefined,
          department: contact.department ?? undefined,
          email: contact.email ?? undefined,
          phone: contact.phone ?? undefined,
          linkedinUrl: contact.linkedinUrl ?? undefined,
          confidenceScore: contact.confidenceScore ?? undefined,
          source: contact.source ?? "enrichment",
          lastVerifiedAt: new Date(),
        },
      });
      added++;
      existingNames.add(fullName.toLowerCase());
    }

    // Update account website if resolved
    if (resolvedWebsite && !account.website) {
      await db.account.update({
        where: { id: account.id },
        data: { website: resolvedWebsite },
      });
    }
  } catch {
    // Phase 2 is non-fatal — Phase 1 results are already saved
  }

  return Response.json({
    data: {
      accountId: account.id,
      companyName: account.companyName,
      contactsAdded: added,
      contactsUpdated: updated,
      totalProcessed: contactsNeedingEnrichment.length,
      providersUsed: [...providersUsed],
    },
    message: `Enrichment complete: ${updated} contacts updated with email/phone, ${added} new contacts found for ${account.companyName}.`,
  });
}
