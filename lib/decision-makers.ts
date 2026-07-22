import { isInstantlyConfigured, verifyEmail } from "@/lib/instantly";
import { parseDomain } from "@/lib/text";
import {
  domainAcceptsMail,
  emailLocalPartMatchesName,
  emailPatternCandidates,
  extractEmailsFromText,
  findPersonContact,
  inferEmailFromSitePattern,
  scrapeSiteForContacts,
  type ScrapedSite,
} from "@/lib/web-contact-scraper";

type SerperResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

/**
 * Extracts a person name from a LinkedIn page title.
 * LinkedIn titles typically look like: "John Smith - Director of Operations | Acme Corp | LinkedIn"
 * or "John Smith | LinkedIn"
 */
function extractNameFromLinkedinTitle(title: string | undefined): string | null {
  if (!title) return null;
  // Strip " | LinkedIn" and similar suffixes
  const cleaned = title.replace(/\s*[|–—-]\s*linkedin.*$/i, "").trim();
  // Take everything before the first pipe or dash that looks like a title/company separator
  const namePart = cleaned.split(/\s*[|–—]\s*/)[0]?.trim() ?? cleaned;
  if (!namePart || namePart.length < 3 || namePart.length > 60) return null;
  // Sanity: should look like a name (letters, spaces, hyphens, dots only)
  if (!/^[A-Za-z\s'.,-]+$/.test(namePart)) return null;
  // Reject generic terms
  if (/^(linkedin|profile|page|people|director|manager|vp|head|chief|coo|president)$/i.test(namePart)) return null;
  return namePart;
}

function isLinkedinProfileUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /linkedin\.com\/in\//i.test(url);
}

async function serperSearch(query: string) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ q: query, num: 10 }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error(`Serper search failed with status ${response.status}`);
      return [];
    }

    const payload = (await response.json()) as { organic?: SerperResult[] };
    return payload.organic ?? [];
  } catch (error) {
    // A timeout on one provider must not reject the whole parallel lookup.
    console.error("Serper search failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function resolveWebsite(companyName: string, providedWebsite?: string | null) {
  if (providedWebsite) return providedWebsite;

  const results = await serperSearch(`${companyName} official website`);
  const firstWebsite = results.find((result) => {
    const link = result.link || "";
    return link.startsWith("http") && !link.includes("linkedin.com");
  });
  return firstWebsite?.link ?? null;
}

type ApolloEnrichedPerson = {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  email_status?: string;
  phone_numbers?: { raw_number: string; type?: string }[];
  linkedin_url?: string;
  organization?: { name?: string; website_url?: string };
};

// ---------------------------------------------------------------------------
// Apollo person-level match — enriches a single known contact by name
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Name cleaning — strip credentials and artifacts before sending to APIs
// ---------------------------------------------------------------------------

// Professional credentials to strip (case-insensitive, comma/space separated)
const CREDENTIAL_PATTERN =
  /\b(?:ma|mha|mba|ms|bs|ba|rn|bsn|msn|lpn|np|pa|md|do|dvm|phd|edd|jd|cpa|cfa|cfp|coo|ceo|cfo|nha|crcst|lnha|fache|facc|chfp|chc|sphr|phr|shrm|six sigma|pmp|ccm|cmc|cadc|lcsw|lmft|lpc)\b/gi;

export function cleanPersonName(raw: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
} {
  if (!raw || raw.trim().length < 2) return { firstName: null, lastName: null, fullName: null };

  let name = raw.trim();

  // Strip everything after " - " (company or title artifacts e.g. "John Smith - circle k")
  name = name.split(/\s+[-–—]\s+/)[0] ?? name;

  // Strip credentials (e.g. "Katie Berzowski, MA, NHA")
  name = name.replace(/,\s*(?:[A-Z]{1,6},?\s*)+$/i, "").trim();
  name = name.replace(CREDENTIAL_PATTERN, "").trim();

  // Strip trailing commas, dots, extra spaces
  name = name.replace(/[,.\s]+$/, "").replace(/\s{2,}/g, " ").trim();

  // Sanity check — should look like a real name (2+ words of letters)
  const parts = name.split(/\s+/).filter((p) => /^[A-Za-z'-]+$/.test(p));
  if (parts.length < 1 || name.length < 3) return { firstName: null, lastName: null, fullName: null };

  // Reject strings that are clearly job titles or page furniture, not names
  const lowerName = name.toLowerCase();
  const titleWords = [
    "operations", "supervisor", "manager", "director", "administrator",
    "coordinator", "specialist", "technician", "nurse", "nursing", "plant",
    "weekend", "regional", "assistant", "associate", "senior", "junior",
    "executive", "office", "clinical", "medical", "social", "staff",
  ];
  if (titleWords.some((w) => lowerName.startsWith(w))) {
    return { firstName: null, lastName: null, fullName: null };
  }

  // Reject strings where NO word could plausibly be a name — catches search
  // snippet artifacts like "Director Details", "Our Team", "Home Care",
  // "Contact Us", "Meet The", "Learn More".
  const junkWords = new Set([
    "director", "details", "team", "staff", "contact", "contacts", "info",
    "about", "our", "the", "us", "we", "meet", "learn", "more", "view",
    "home", "care", "health", "medical", "services", "service", "center",
    "leadership", "management", "profile", "page", "group", "facility",
    "senior", "living", "assisted", "nursing", "hospice", "clinic", "best",
    "quality", "community", "welcome", "read", "click", "here", "email",
    "phone", "call", "today", "now", "find", "search",
  ]);
  const words = lowerName.split(/\s+/);
  if (words.length >= 2 && words.every((w) => junkWords.has(w))) {
    return { firstName: null, lastName: null, fullName: null };
  }

  const firstName = parts[0] ?? null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

  return { firstName, lastName, fullName: name };
}

export type ApolloContactMatch = {
  email: string | null;
  /** Deliverability of `email`: "verified" | "risky" | "guessed" | null (not checked). */
  emailStatus: string | null;
  phone: string | null;
  /** "direct" (person's own number) | "main_line" (facility front desk) | null. */
  phoneType: string | null;
  linkedinUrl: string | null;
  title: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  confidenceScore: number;
  /** Where the primary data (email if present) came from. */
  source: string;
  /** Every source that contributed data. */
  sourcesUsed: string[];
};

// ---------------------------------------------------------------------------
// Hunter Email Finder — non-Apollo/PDL email lookup by name + domain.
// Uses Hunter credits, but this is the "keep Apollo/PDL as backup" tier.
// ---------------------------------------------------------------------------

async function hunterEmailFinder(
  firstName: string,
  lastName: string,
  domain: string,
): Promise<{ email: string; score: number; position: string | null; phone: string | null } | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL("https://api.hunter.io/v2/email-finder");
    url.searchParams.set("domain", domain);
    url.searchParams.set("first_name", firstName);
    url.searchParams.set("last_name", lastName);

    const response = await fetch(url, {
      headers: { "X-API-KEY": apiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: { email?: string | null; score?: number | null; position?: string | null; phone_number?: string | null };
    };
    const data = payload.data;
    if (!data?.email || (data.score ?? 0) < 60) return null;

    return {
      email: data.email,
      score: data.score ?? 60,
      position: data.position ?? null,
      phone: data.phone_number ?? null,
    };
  } catch (error) {
    console.error("Hunter email finder failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Hunts for a person's published email in Google results (via Serper) —
 *  staff directories, PDFs, county provider lists, and association pages
 *  often expose emails that B2B databases miss. Only accepts an address
 *  whose local part is a recognizable form of the person's name. */
async function serperEmailHunt(
  fullName: string,
  organizationName: string,
  firstName: string | null,
  lastName: string | null,
  domain: string | null,
): Promise<string | null> {
  if (!process.env.SERPER_API_KEY) return null;

  const queries = [
    `"${fullName}" "${organizationName}" email`,
    ...(domain ? [`"${fullName}" "@${domain}"`] : []),
    // Staff directories, county provider lists, and association rosters are
    // usually published as PDFs — a rich source B2B databases never index.
    `"${fullName}" "${organizationName}" (email OR contact) filetype:pdf`,
  ];

  for (const query of queries) {
    const results = await serperSearch(query);
    const text = results.map((r) => `${r.title ?? ""} ${r.snippet ?? ""}`).join(" ");
    for (const email of extractEmailsFromText(text)) {
      if (emailLocalPartMatchesName(email, firstName, lastName)) return email;
    }
  }
  return null;
}

/** Guess-and-verify: generates the most common corporate email shapes for
 *  the person and checks each against Instantly's email verifier. Only a
 *  VERIFIED, non-catch-all address is accepted, so the result is a real,
 *  deliverable email — not a guess. */
async function guessAndVerifyEmail(
  firstName: string | null,
  lastName: string | null,
  domain: string,
): Promise<string | null> {
  if (!isInstantlyConfigured()) return null;

  const candidates = emailPatternCandidates(firstName, lastName, domain).slice(0, 3);
  if (!candidates.length) return null;
  if (!(await domainAcceptsMail(domain))) return null;

  for (const candidate of candidates) {
    const result = await verifyEmail(candidate);
    // Catch-all domains accept every address — a "verified" there proves nothing.
    if (result.status === "verified" && !result.catchAll) return candidate;
    if (result.status === "error") return null; // API problem — stop burning credits
  }
  return null;
}

/** Finds a person's LinkedIn profile via Serper — free-tier step that also
 *  makes the Apollo/PDL backup lookups far more precise. */
async function findLinkedinForPerson(
  fullName: string,
  organizationName: string,
): Promise<string | null> {
  if (!process.env.SERPER_API_KEY) return null;

  const results = await serperSearch(`site:linkedin.com/in "${fullName}" "${organizationName}"`);
  const lastName = fullName.split(/\s+/).pop()?.toLowerCase() ?? "";

  const hit = results.find((result) => {
    if (!isLinkedinProfileUrl(result.link)) return false;
    const extracted = extractNameFromLinkedinTitle(result.title)?.toLowerCase() ?? "";
    return lastName.length >= 3 && extracted.includes(lastName);
  });
  return hit?.link ?? null;
}

async function enrichContactFromApollo(input: {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  organizationName: string;
  domain?: string | null;
  linkedinUrl?: string | null;
}): Promise<ApolloContactMatch | null> {
  const apolloKey = process.env.APOLLO_API_KEY;
  const apolloPlanEnabled = process.env.APOLLO_PLAN_ENABLED === "true";
  if (!apolloKey || !apolloPlanEnabled) return null;

  const body: Record<string, unknown> = {
    organization_name: input.organizationName,
    reveal_personal_emails: false,
    reveal_phone_number: true,
  };
  if (input.linkedinUrl) {
    body.linkedin_url = input.linkedinUrl;
  } else {
    body.first_name = input.firstName;
    body.last_name = input.lastName;
  }
  if (input.domain) body.domain = input.domain;

  try {
    const response = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apolloKey,
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { person?: ApolloEnrichedPerson };
    const person = payload.person;
    if (!person || (!person.email && !person.phone_numbers?.length)) return null;

    const primaryPhone =
      person.phone_numbers?.find((p) => p.type === "work_direct")?.raw_number ??
      person.phone_numbers?.[0]?.raw_number ??
      null;

    return {
      email: person.email ?? null,
      emailStatus: null,
      phone: primaryPhone,
      phoneType: primaryPhone ? "direct" : null,
      linkedinUrl: person.linkedin_url ?? null,
      title: person.title ?? null,
      firstName: person.first_name ?? input.firstName,
      lastName: person.last_name ?? input.lastName,
      fullName: person.name ?? input.fullName,
      confidenceScore: person.email ? 0.95 : 0.7,
      source: "apollo",
      sourcesUsed: ["apollo"],
    };
  } catch {
    return null;
  }
}

/**
 * Free-first enrichment cascade for a single known contact:
 *
 *   1. The facility's own website (free) — staff/contact pages often list
 *      the exact person's email and direct phone.
 *   2. Google/SERP email hunt via Serper — directories, PDFs, and state
 *      provider lists publish emails that B2B databases miss; only accepts
 *      addresses whose local part matches the person's name.
 *   3. Hunter email finder (non-Apollo/PDL, uses Hunter credits).
 *   4. LinkedIn profile lookup via Serper (free tier of value on its own,
 *      and it sharpens the paid lookups below).
 *   5. Apollo people/match — BACKUP (requires APOLLO_PLAN_ENABLED).
 *   6. People Data Labs — BACKUP.
 *   7. Guess-and-verify — generates common email shapes and confirms them
 *      with Instantly's verifier; only VERIFIED non-catch-all addresses
 *      are accepted.
 *   8. Site email-pattern guess (first.last@) — true last resort, clearly
 *      low-confidence and MX-verified only.
 */
export async function enrichContactByName(
  input: {
    firstName: string | null;
    lastName: string | null;
    fullName?: string | null;
    organizationName: string;
    domain?: string | null;
    website?: string | null;
    linkedinUrl?: string | null;
  },
  options: { scrapedSite?: ScrapedSite | null } = {},
): Promise<ApolloContactMatch | null> {
  // Clean the name before sending anywhere — strips credentials,
  // company-name artifacts, and non-person strings
  const cleaned = cleanPersonName(input.fullName ?? [input.firstName, input.lastName].filter(Boolean).join(" "));

  const firstName = cleaned.firstName ?? input.firstName;
  const lastName = cleaned.lastName ?? input.lastName;
  if (!firstName && !input.linkedinUrl) return null;

  const sourcesUsed: string[] = [];
  let email: string | null = null;
  let emailSource = "";
  let emailStatus: string | null = null;
  let phone: string | null = null;
  let phoneType: string | null = null;
  let title: string | null = null;
  let linkedinUrl = input.linkedinUrl ?? null;
  let confidence = 0;

  // ---- 1. Facility website (free) ----
  // A scrape can be passed in (enrich-account scrapes once per account and
  // reuses it for every contact); `undefined` means scrape here.
  let site = options.scrapedSite;
  const websiteForScrape = input.website ?? (input.domain ? `https://${input.domain}` : null);
  if (site === undefined) {
    site = websiteForScrape ? await scrapeSiteForContacts(websiteForScrape) : null;
  }

  if (site && firstName && lastName) {
    const hit = findPersonContact(site, firstName, lastName);
    if (hit.email) {
      email = hit.email;
      emailSource = "website";
      confidence = 0.82;
      sourcesUsed.push("website");
    }
    if (hit.phone) {
      phone = hit.phone;
      phoneType = "direct";
      if (!sourcesUsed.includes("website")) sourcesUsed.push("website");
    }
  }

  // ---- 2. Google/SERP email hunt (Serper) ----
  const domain = input.domain ?? site?.domain ?? null;
  const fullNameEarly = cleaned.fullName ?? [firstName, lastName].filter(Boolean).join(" ");
  if (!email && fullNameEarly && firstName && lastName) {
    const hunted = await serperEmailHunt(
      fullNameEarly,
      input.organizationName,
      firstName,
      lastName,
      domain,
    );
    if (hunted) {
      email = hunted;
      emailSource = "serper_email_hunt";
      confidence = 0.75;
      sourcesUsed.push("serper_email_hunt");
    }
  }

  // ---- 3. Hunter email finder (non-Apollo/PDL) ----
  if (!email && firstName && lastName && domain) {
    const hunterHit = await hunterEmailFinder(firstName, lastName, domain);
    if (hunterHit) {
      email = hunterHit.email;
      emailSource = "hunter";
      confidence = Math.min(hunterHit.score / 100, 0.95);
      title = title ?? hunterHit.position;
      if (!phone && hunterHit.phone) {
        phone = hunterHit.phone;
        phoneType = "direct";
      }
      sourcesUsed.push("hunter");
    }
  }

  // ---- 4. LinkedIn profile via Serper (free-tier value + sharpens backups) ----
  const fullNameForSearch = fullNameEarly;
  if (!linkedinUrl && fullNameForSearch) {
    linkedinUrl = await findLinkedinForPerson(fullNameForSearch, input.organizationName);
    if (linkedinUrl) sourcesUsed.push("serper");
  }

  // ---- 5/6. Paid backups — only when the free tier didn't find an email ----
  if (!email) {
    const backup =
      (await enrichContactFromApollo({
        firstName,
        lastName,
        fullName: cleaned.fullName,
        organizationName: input.organizationName,
        domain,
        linkedinUrl,
      })) ??
      (await enrichContactFromPDL({
        firstName,
        lastName,
        organizationName: input.organizationName,
        domain,
        linkedinUrl,
      }));

    if (backup) {
      email = backup.email;
      emailSource = backup.email ? backup.source : emailSource;
      if (!phone && backup.phone) {
        phone = backup.phone;
        phoneType = backup.phoneType ?? "direct";
      }
      title = title ?? backup.title;
      linkedinUrl = linkedinUrl ?? backup.linkedinUrl;
      confidence = Math.max(confidence, backup.confidenceScore);
      sourcesUsed.push(backup.source);
    }
  }

  // ---- 7. Guess-and-verify via Instantly's email verifier ----
  if (!email && domain && firstName && lastName) {
    const verified = await guessAndVerifyEmail(firstName, lastName, domain);
    if (verified) {
      email = verified;
      emailSource = "verified_pattern";
      emailStatus = "verified";
      confidence = Math.max(confidence, 0.9);
      sourcesUsed.push("verified_pattern");
    }
  }

  // ---- 8. Last resort: unverified pattern guess from the site's own format ----
  if (!email && site) {
    const guessed = await inferEmailFromSitePattern(site, firstName, lastName);
    if (guessed) {
      email = guessed;
      emailSource = "email_pattern_guess";
      emailStatus = "guessed";
      confidence = Math.max(confidence, 0.45);
      sourcesUsed.push("email_pattern_guess");
    }
  }

  // ---- Verification gate: any email that wasn't already verified gets one
  // deliverability check before it's allowed into the CRM. An invalid address
  // is worse than none — it bounces, burns sender reputation, and reads as a
  // dead contact — so invalids are dropped outright.
  if (email && emailStatus === null && isInstantlyConfigured()) {
    const check = await verifyEmail(email);
    if (check.status === "verified" && !check.catchAll) {
      emailStatus = "verified";
      confidence = Math.max(confidence, 0.9);
      sourcesUsed.push("instantly_verify");
    } else if (check.status === "invalid") {
      email = null;
      emailSource = "";
    } else {
      emailStatus = "risky"; // catch-all domain or verification pending/errored
    }
  }

  if (!email && !phone && !linkedinUrl) return null;
  // A pre-existing LinkedIn URL alone isn't new data.
  if (!email && !phone && linkedinUrl === (input.linkedinUrl ?? null)) return null;

  return {
    email,
    emailStatus: email ? emailStatus : null,
    phone,
    phoneType: phone ? phoneType : null,
    linkedinUrl,
    title,
    firstName,
    lastName,
    fullName: cleaned.fullName ?? fullNameForSearch ?? null,
    confidenceScore: confidence || (email ? 0.6 : 0.55),
    source: emailSource || sourcesUsed[0] || "enrichment",
    sourcesUsed,
  };
}

// ---------------------------------------------------------------------------
// People Data Labs (PDL) — person enrichment fallback
// Broader coverage than Apollo, especially for healthcare, non-B2B industries
// ---------------------------------------------------------------------------

type PDLPersonResponse = {
  status: number;
  likelihood?: number;
  data?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    job_title?: string;
    emails?: { address: string; type?: string }[];
    phone_numbers?: { number: string }[];
    linkedin_url?: string;
  };
};

async function enrichContactFromPDL(input: {
  firstName: string | null;
  lastName: string | null;
  organizationName: string;
  domain?: string | null;
  linkedinUrl?: string | null;
}): Promise<ApolloContactMatch | null> {
  const apiKey = process.env.PDL_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams();
    params.set("min_likelihood", "6"); // PDL uses 0–10 integer scale

    if (input.linkedinUrl) {
      params.set("profile", input.linkedinUrl.replace(/^https?:\/\//, ""));
    } else {
      if (input.firstName) params.set("first_name", input.firstName);
      if (input.lastName) params.set("last_name", input.lastName);
      params.set("company", input.organizationName);
      if (input.domain) params.set("company_domain", input.domain);
    }

    const response = await fetch(
      `https://api.peopledatalabs.com/v5/person/enrich?${params.toString()}`,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    // 404 = no match (not an error), anything else unexpected = bail
    if (response.status === 404) return null;
    if (!response.ok) return null;

    const payload = (await response.json()) as PDLPersonResponse;
    if (!payload.data) return null;

    const { data } = payload;
    const primaryEmail =
      data.emails?.find((e) => e.type === "professional")?.address ??
      data.emails?.[0]?.address ??
      null;
    const primaryPhone = data.phone_numbers?.[0]?.number ?? null;

    return {
      email: primaryEmail,
      emailStatus: null,
      phone: primaryPhone,
      phoneType: primaryPhone ? "direct" : null,
      linkedinUrl: data.linkedin_url ? `https://${data.linkedin_url}` : null,
      title: data.job_title ?? null,
      firstName: data.first_name ?? null,
      lastName: data.last_name ?? null,
      fullName: data.full_name ?? null,
      confidenceScore: primaryEmail ? 0.88 : 0.65,
      source: "pdl",
      sourcesUsed: ["pdl"],
    };
  } catch {
    return null;
  }
}
