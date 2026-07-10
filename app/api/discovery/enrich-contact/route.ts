import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { enrichContactByName } from "@/lib/decision-makers";
import { parseDomain } from "@/lib/text";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null);
  const contactId = typeof body?.contactId === "string" ? body.contactId : null;

  if (!contactId) {
    return Response.json({ error: "contactId is required" }, { status: 400 });
  }

  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      account: { select: { companyName: true, website: true } },
    },
  });

  if (!contact) {
    return Response.json({ error: "Contact not found" }, { status: 404 });
  }

  const domain = parseDomain(contact.account.website);

  const match = await enrichContactByName({
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: contact.fullName,
    organizationName: contact.account.companyName,
    domain,
    website: contact.account.website,
    linkedinUrl: contact.linkedinUrl,
  });

  if (!match) {
    const reason = contact.account.website
      ? "No match found via website scrape, Hunter, or the Apollo/PDL backups."
      : "The account has no website (which the free lookup needs) and no provider found a match.";
    return Response.json({
      data: { updated: false, reason },
      message: "No match found. Add the account's website or a LinkedIn URL to this contact and retry.",
    });
  }

  const hasNewData =
    (!contact.email && match.email) ||
    (!contact.phone && match.phone) ||
    (!contact.linkedinUrl && match.linkedinUrl);

  if (!hasNewData) {
    return Response.json({
      data: { updated: false, reason: "Contact already has all available data." },
      message: "Contact is already up to date.",
    });
  }

  const updated = await db.contact.update({
    where: { id: contact.id },
    data: {
      email: contact.email ?? match.email ?? undefined,
      phone: contact.phone ?? match.phone ?? undefined,
      linkedinUrl: contact.linkedinUrl ?? match.linkedinUrl ?? undefined,
      title: contact.title ?? match.title ?? undefined,
      firstName: contact.firstName ?? match.firstName ?? undefined,
      lastName: contact.lastName ?? match.lastName ?? undefined,
      confidenceScore: Math.max(contact.confidenceScore ?? 0, match.confidenceScore),
      source: match.source,
      lastVerifiedAt: new Date(),
    },
  });

  return Response.json({
    data: {
      updated: true,
      contactId: updated.id,
      email: updated.email,
      phone: updated.phone,
      linkedinUrl: updated.linkedinUrl,
      sourcesUsed: match.sourcesUsed,
    },
    message: `Contact enriched via ${match.sourcesUsed.join(" + ") || "enrichment"}: ${match.email ? "email found" : ""}${match.email && match.phone ? " + " : ""}${match.phone ? "phone found" : ""}.`,
  });
}
