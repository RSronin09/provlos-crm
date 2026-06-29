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

    for (const contact of contacts) {
      const fullName =
        contact.fullName ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      if (!fullName) continue;

      const existing =
        (contact.email
          ? await db.contact.findFirst({
              where: {
                accountId: account.id,
                email: { equals: contact.email, mode: "insensitive" },
              },
            })
          : null) ??
        (await db.contact.findFirst({
          where: {
            accountId: account.id,
            fullName: { equals: fullName, mode: "insensitive" },
          },
        }));

      if (existing) continue;

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
        totalContacts: contacts.length,
        providersUsed,
        resolvedWebsite,
      },
      message: `Enrichment complete: ${added} new contacts added for ${account.companyName}.`,
    });
  } catch (err) {
    return Response.json(
      { error: "Enrichment failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
