import { db } from "@/lib/db";
import { NextRequest } from "next/server";

// Diagnostic endpoint — shows exactly what gets sent to each API and what comes back
// Usage: POST /api/discovery/debug-enrich { "contactId": "..." }
// Remove or restrict this endpoint before going to production with sensitive data

export async function POST(request: NextRequest) {
  const body = await request.json();
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

  const domain = contact.account.website
    ? (() => {
        try {
          const url = contact.account.website!.startsWith("http")
            ? contact.account.website!
            : `https://${contact.account.website}`;
          return new URL(url).hostname.replace(/^www\./, "");
        } catch { return null; }
      })()
    : null;

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

  // --- Name cleaning ---
  const rawName = contact.fullName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  const CREDENTIAL_PATTERN = /\b(?:ma|mha|mba|ms|bs|ba|rn|bsn|msn|lpn|np|pa|md|do|dvm|phd|edd|jd|cpa|cfa|cfp|coo|ceo|cfo|nha|crcst|lnha|fache|facc|chfp|chc|sphr|phr|shrm|six sigma|pmp|ccm|cmc|cadc|lcsw|lmft|lpc)\b/gi;
  let cleanedName = rawName.trim();
  cleanedName = cleanedName.split(/\s+[-–—]\s+/)[0] ?? cleanedName;
  cleanedName = cleanedName.replace(/,\s*(?:[A-Z]{1,6},?\s*)+$/i, "").trim();
  cleanedName = cleanedName.replace(CREDENTIAL_PATTERN, "").trim();
  cleanedName = cleanedName.replace(/[,.\s]+$/, "").replace(/\s{2,}/g, " ").trim();
  const parts = cleanedName.split(/\s+/).filter((p: string) => /^[A-Za-z'-]+$/.test(p));
  const looksLikePerson = parts.length >= 1 && cleanedName.length >= 3;
  const titleWords = ["operations","supervisor","manager","director","administrator","coordinator","specialist","technician","nurse","nursing","plant","weekend","regional","assistant","associate","senior","junior"];
  const isTitleNotName = titleWords.some((w: string) => cleanedName.toLowerCase().startsWith(w));

  diagnostics.nameCleaning = {
    rawName,
    cleanedName,
    parts,
    looksLikePerson,
    isTitleNotName,
    wouldSkip: !looksLikePerson || isTitleNotName,
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };

  // --- Apollo test ---
  if (process.env.APOLLO_API_KEY && looksLikePerson && !isTitleNotName) {
    const apolloBody: Record<string, unknown> = {
      organization_name: contact.account.companyName,
      reveal_personal_emails: false,
      // Phone reveal requires a public webhook_url — Apollo rejects the
      // request otherwise, so the diagnostic mirrors production and skips it.
      reveal_phone_number: false,
    };
    if (contact.linkedinUrl) {
      apolloBody.linkedin_url = contact.linkedinUrl;
    } else {
      apolloBody.first_name = parts[0] ?? null;
      apolloBody.last_name = parts.length > 1 ? parts.slice(1).join(" ") : null;
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
        const legacyRaw = await legacyRes.json();
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
      : isTitleNotName
        ? "Name looks like a job title, not a person"
        : "Name failed validation";
  }

  // --- PDL test ---
  if (process.env.PDL_API_KEY && looksLikePerson && !isTitleNotName) {
    const pdlParams = new URLSearchParams();
    pdlParams.set("min_likelihood", "6"); // PDL uses 0–10 integer scale
    if (contact.linkedinUrl) {
      pdlParams.set("profile", contact.linkedinUrl.replace(/^https?:\/\//, ""));
    } else {
      if (parts[0]) pdlParams.set("first_name", parts[0]);
      if (parts.length > 1) pdlParams.set("last_name", parts.slice(1).join(" "));
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

      const raw = await res.json();
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
      : isTitleNotName
        ? "Name looks like a job title"
        : "Name failed validation";
  }

  return Response.json({ diagnostics });
}
