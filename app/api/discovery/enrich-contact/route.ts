import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { enrichContactByName } from "@/lib/decision-makers";
import { lookupPlace, resolveWebsiteSafe } from "@/lib/places";
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
      account: {
        select: { id: true, companyName: true, website: true, phone: true, city: true, state: true },
      },
    },
  });

  if (!contact) {
    return Response.json({ error: "Contact not found" }, { status: 404 });
  }

  // Registry-imported facilities arrive without a website, and both the free
  // scrape and Hunter depend on it — find and save it before enriching.
  let website = contact.account.website;
  if (!website && process.env.SERPER_API_KEY) {
    try {
      website = await resolveWebsiteSafe(contact.account.companyName, {
        city: contact.account.city,
        state: contact.account.state,
      });
      if (website) {
        await db.account.update({ where: { id: contact.account.id }, data: { website } });
      }
    } catch {
      website = null;
    }
  }
  const domain = parseDomain(website);

  const match = await enrichContactByName({
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: contact.fullName,
    organizationName: contact.account.companyName,
    domain,
    website,
    linkedinUrl: contact.linkedinUrl,
  });

  // Guaranteed fallback channel: when the cascade found no phone, fall back to
  // the facility's main line (account record, else Google Business via Serper
  // Places) so the contact is still reachable as "call, ask for <name>".
  let mainLinePhone: string | null = null;
  if (!contact.phone && !match?.phone) {
    mainLinePhone = contact.account.phone;
    if (!mainLinePhone) {
      const place = await lookupPlace(contact.account.companyName, {
        city: contact.account.city,
        state: contact.account.state,
        domain,
      });
      if (place?.phone) {
        mainLinePhone = place.phone;
        await db.account.update({
          where: { id: contact.account.id },
          data: {
            phone: place.phone,
            website: website ?? place.website ?? undefined,
          },
        });
      }
    }
  }

  if (!match && mainLinePhone) {
    const updated = await db.contact.update({
      where: { id: contact.id },
      data: { phone: mainLinePhone, phoneType: "main_line" },
    });
    return Response.json({
      data: { updated: true, contactId: updated.id, phone: updated.phone, phoneType: "main_line" },
      message: "No direct contact info found, but the facility's main line was attached — call and ask for this contact by name.",
    });
  }

  if (!match) {
    // Spell out what actually ran vs. what was skipped, so "No match" is
    // debuggable from the UI without reading server logs.
    const tried: string[] = [];
    const missing: string[] = [];
    if (website) tried.push("facility website");
    else missing.push(process.env.SERPER_API_KEY ? "no website found for this account" : "account website (set it, or add SERPER_API_KEY to find it automatically)");
    if (website && process.env.HUNTER_API_KEY) tried.push("Hunter");
    else if (!process.env.HUNTER_API_KEY) missing.push("HUNTER_API_KEY");
    if (process.env.SERPER_API_KEY) tried.push("LinkedIn search");
    else missing.push("SERPER_API_KEY");
    if (process.env.APOLLO_API_KEY && process.env.APOLLO_PLAN_ENABLED === "true") tried.push("Apollo");
    else missing.push(process.env.APOLLO_API_KEY ? "APOLLO_PLAN_ENABLED" : "APOLLO_API_KEY");
    if (process.env.PDL_API_KEY) tried.push("PDL");
    else missing.push("PDL_API_KEY");

    const reason = `${tried.length ? `Tried: ${tried.join(", ")} — no public email found.` : "Nothing to search with."}${missing.length ? ` Unavailable: ${missing.join(", ")}.` : ""}`;
    return Response.json({
      data: { updated: false, reason, tried, missing },
      message: "No match found. Add the account's website or a LinkedIn URL to this contact and retry.",
    });
  }

  const fallbackPhone = match.phone ?? mainLinePhone;
  const hasNewData =
    (!contact.email && match.email) ||
    (!contact.phone && fallbackPhone) ||
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
      emailStatus: contact.email ? undefined : (match.email ? match.emailStatus : undefined),
      phone: contact.phone ?? fallbackPhone ?? undefined,
      phoneType: contact.phone
        ? undefined
        : (match.phone ? match.phoneType : (mainLinePhone ? "main_line" : undefined)),
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
