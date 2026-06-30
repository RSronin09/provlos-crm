import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { lookupDecisionMakers } from "@/lib/decision-makers";
import { NextRequest } from "next/server";

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
    select: { id: true, companyName: true, website: true },
  });

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const { contacts, resolvedWebsite, providersUsed } = await lookupDecisionMakers({
      companyName: account.companyName,
      website: account.website,
    });

    let added = 0;
    let updated = 0;

    for (const contact of contacts) {
      const fullName =
        contact.fullName ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      if (!fullName) continue;

      // Look for existing contact by email match first, then by name
      const existingByEmail = contact.email
        ? await db.contact.findFirst({
            where: {
              accountId: account.id,
              email: { equals: contact.email, mode: "insensitive" },
            },
          })
        : null;

      const existingByName = await db.contact.findFirst({
        where: {
          accountId: account.id,
          fullName: { equals: fullName, mode: "insensitive" },
        },
      });

      const existing = existingByEmail ?? existingByName;

      if (existing) {
        // Update the existing contact if Apollo found new email/phone/linkedin
        // that wasn't there before — this is the key fix for existing contacts
        const needsUpdate =
          (!existing.email && contact.email) ||
          (!existing.phone && contact.phone) ||
          (!existing.linkedinUrl && contact.linkedinUrl) ||
          (!existing.title && contact.title);

        if (needsUpdate) {
          await db.contact.update({
            where: { id: existing.id },
            data: {
              email: existing.email ?? contact.email ?? undefined,
              phone: existing.phone ?? contact.phone ?? undefined,
              linkedinUrl: existing.linkedinUrl ?? contact.linkedinUrl ?? undefined,
              title: existing.title ?? contact.title ?? undefined,
              department: existing.department ?? contact.department ?? undefined,
              firstName: existing.firstName ?? contact.firstName ?? undefined,
              lastName: existing.lastName ?? contact.lastName ?? undefined,
              confidenceScore: Math.max(
                existing.confidenceScore ?? 0,
                contact.confidenceScore ?? 0,
              ),
              source: contact.source ?? existing.source ?? undefined,
              lastVerifiedAt: new Date(),
            },
          });
          updated++;
        }
        continue;
      }

      // Brand new contact — create it
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
    }

    // Update account website if we resolved a better one
    if (resolvedWebsite && !account.website) {
      await db.account.update({
        where: { id: account.id },
        data: { website: resolvedWebsite },
      });
    }

    return Response.json({
      data: {
        accountId: account.id,
        companyName: account.companyName,
        contactsAdded: added,
        contactsUpdated: updated,
        totalContacts: contacts.length,
        providersUsed,
        resolvedWebsite,
      },
      message: `Enrichment complete: ${added} new contacts added, ${updated} existing contacts updated for ${account.companyName}.`,
    });
  } catch (err) {
    return Response.json(
      { error: "Enrichment failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
