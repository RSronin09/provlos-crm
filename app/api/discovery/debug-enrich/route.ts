import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { cleanPersonName } from "@/lib/decision-makers";
import { parseDomain } from "@/lib/text";
import { NextRequest } from "next/server";

// Diagnostic endpoint — shows exactly what gets sent to each API and what comes back.
// Returns contact PII and provider request/response details, so it is admin-gated.
// Usage: POST /api/discovery/debug-enrich { "contactId": "..." }

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
    include: { account: { select: { companyName: true, website: true } } },
  });

  if (!contact) {
    return Response.json({ error: "Contact not found" }, { status: 404 });
  }

  const domain = parseDomain(contact.account.website);

  const diagnostics: Record<string, unknown> = {
    contact: {
      id: contact.id,
      fullName: contact.fullName,
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title,
      email: contact.email,
      phone: contact.phone,
      linkedinUrl: contact.linkedinUrl,
      source: contact.source,
    },
    account: {
      companyName: contact.account.companyName,
      website: contact.account.website,
      resolvedDomain: domain,
    },
    environment: {
      hasApolloKey: !!process.env.APOLLO_API_KEY,
      hasPdlKey: !!process.env.PDL_API_KEY,
      hasHunterKey: !!process.env.HUNTER_API_KEY,
      hasSerperKey: !!process.env.SERPER_API_KEY,
    },
  };

  // --- Name cleaning (same logic used by real enrichment via cleanPersonName) ---
  const rawName = contact.fullName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  const cleaned = cleanPersonName(rawName);
  const nameUsable = !!cleaned.fullName;

  diagnostics.nameCleaning = {
    rawName,
    cleanedName: cleaned.fullName,
    firstName: cleaned.firstName,
    lastName: cleaned.lastName,
    wouldSkip: !nameUsable,
  };

  // --- Apollo test ---
  if (process.env.APOLLO_API_KEY && nameUsable) {
    const apolloBody: Record<string, unknown> = {
      organization_name: contact.account.companyName,
      reveal_personal_emails: false,
      reveal_phone_number: true,
    };
    if (contact.linkedinUrl) {
      apolloBody.linkedin_url = contact.linkedinUrl;
    } else {
      apolloBody.first_name = cleaned.firstName;
      apolloBody.last_name = cleaned.lastName;
    }
    if (domain) apolloBody.domain = domain;

    diagnostics.apolloRequest = apolloBody;

    try {
      // Try new API path first, fall back to legacy path
      let res = await fetch("https://api.apollo.io/api/v1/people/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": process.env.APOLLO_API_KEY,
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(apolloBody),
        signal: AbortSignal.timeout(10_000),
      });

      // If 403, try legacy path
      if (res.status === 403) {
        const legacyBody = { ...apolloBody, api_key: process.env.APOLLO_API_KEY };
        const legacyRes = await fetch("https://api.apollo.io/v1/people/match", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
          body: JSON.stringify(legacyBody),
          signal: AbortSignal.timeout(10_000),
        });
        diagnostics.apolloLegacyStatus = legacyRes.status;
        const legacyRaw = await legacyRes.json().catch(() => ({}));
        diagnostics.apolloLegacyResponse = {
          hasPerson: !!legacyRaw?.person,
          email: legacyRaw?.person?.email ?? null,
          phoneCount: legacyRaw?.person?.phone_numbers?.length ?? 0,
          errorMessage: legacyRaw?.error ?? null,
          errorCode: legacyRaw?.error_code ?? null,
        };
        if (legacyRes.ok) res = legacyRes;
      }

      const raw = await res.json().catch(() => ({}));
      diagnostics.apolloStatus = res.status;
      diagnostics.apolloResponse = {
        hasPerson: !!raw?.person,
        email: raw?.person?.email ?? null,
        phoneCount: raw?.person?.phone_numbers?.length ?? 0,
        name: raw?.person?.name ?? null,
        title: raw?.person?.title ?? null,
        rawKeys: raw ? Object.keys(raw) : [],
        errorMessage: raw?.error ?? null,
        errorCode: raw?.error_code ?? null,
      };
    } catch (e) {
      diagnostics.apolloError = String(e);
    }
  } else {
    diagnostics.apolloSkipped = !process.env.APOLLO_API_KEY
      ? "No APOLLO_API_KEY"
      : "Name failed validation (job title or non-person string)";
  }

  // --- PDL test ---
  if (process.env.PDL_API_KEY && nameUsable) {
    const pdlParams = new URLSearchParams();
    pdlParams.set("min_likelihood", "6"); // PDL uses 0–10 integer scale
    if (contact.linkedinUrl) {
      pdlParams.set("profile", contact.linkedinUrl.replace(/^https?:\/\//, ""));
    } else {
      if (cleaned.firstName) pdlParams.set("first_name", cleaned.firstName);
      if (cleaned.lastName) pdlParams.set("last_name", cleaned.lastName);
      pdlParams.set("company", contact.account.companyName);
      if (domain) pdlParams.set("company_domain", domain);
    }

    diagnostics.pdlRequest = Object.fromEntries(pdlParams.entries());

    try {
      const res = await fetch(
        `https://api.peopledatalabs.com/v5/person/enrich?${pdlParams.toString()}`,
        {
          headers: { "X-Api-Key": process.env.PDL_API_KEY, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        },
      );

      const raw = await res.json().catch(() => ({}));
      diagnostics.pdlStatus = res.status;
      diagnostics.pdlResponse = {
        likelihood: raw?.likelihood ?? null,
        hasData: !!raw?.data,
        email: raw?.data?.emails?.[0]?.address ?? null,
        phone: raw?.data?.phone_numbers?.[0]?.number ?? null,
        name: raw?.data?.full_name ?? null,
        title: raw?.data?.job_title ?? null,
        rawKeys: raw ? Object.keys(raw) : [],
        error: raw?.error ?? null,
      };
    } catch (e) {
      diagnostics.pdlError = String(e);
    }
  } else {
    diagnostics.pdlSkipped = !process.env.PDL_API_KEY
      ? "No PDL_API_KEY"
      : "Name failed validation (job title or non-person string)";
  }

  return Response.json({ diagnostics });
}
