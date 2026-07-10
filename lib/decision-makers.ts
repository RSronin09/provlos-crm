import { parseDomain } from "@/lib/text";
import {
  findPersonContact,
  inferEmailFromSitePattern,
  scrapeSiteForContacts,
  type ScrapedSite,
} from "@/lib/web-contact-scraper";

type DecisionMakerContact = {
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  confidenceScore: number;
  source: string;
};

type LookupInput = {
  companyName: string;
  website?: string | null;
};

type LookupOutput = {
  resolvedWebsite: string | null;
  contacts: DecisionMakerContact[];
  providersUsed: string[];
};

type SerperResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

function titleToDepartment(title: string | null) {
  if (!title) return null;
  const normalized = title.toLowerCase();
  if (normalized.includes("social")) return "Social Services";
  if (normalized.includes("case manage") || normalized.includes("discharge")) return "Case Management";
  if (normalized.includes("transport")) return "Transportation";
  if (normalized.includes("admissions")) return "Admissions";
  if (normalized.includes("nursing") || normalized.includes("clinical")) return "Nursing";
  if (normalized.includes("activities")) return "Activities";
  if (normalized.includes("operations")) return "Operations";
  if (normalized.includes("administrat") || normalized.includes("executive director")) return "Administration";
  if (normalized.includes("office") || normalized.includes("practice") || normalized.includes("clinic manager")) return "Office Management";
  return null;
}

function splitName(fullName: string) {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: cleaned, lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

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

/**
 * Extracts a job title from a LinkedIn page title.
 * e.g. "John Smith - Director of Operations | Acme Corp | LinkedIn" → "Director of Operations"
 */
function extractTitleFromLinkedinTitle(title: string | undefined): string | null {
  if (!title) return null;
  // LinkedIn title structure: "Name - Title | Company | LinkedIn"
  const dashMatch = title.match(/-\s*([^|–—]+(?:director|vp|vice president|manager|head|chief|coo|coordinator|analyst|specialist|officer|supervisor|lead)[^|–—]*)/i);
  if (dashMatch?.[1]) return dashMatch[1].trim().replace(/\s+/g, " ");
  return null;
}

function extractTitleFromSnippet(snippet: string | undefined): string | null {
  if (!snippet) return null;
  const patterns = [
    /\b((?:chief|vp|vice president|director|head|manager|coordinator|officer|supervisor|lead|administrator|planner)\s+(?:of\s+)?[^,.;|]{3,60})/i,
    /\b((?:social services|case management|admissions|nursing|activities|transportation|operations)\s+(?:director|manager|head|coordinator|vp|vice president|officer|supervisor|lead|planner)[^,.;|]{0,40})/i,
  ];
  for (const pattern of patterns) {
    const match = snippet.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function isLinkedinProfileUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /linkedin\.com\/in\//i.test(url);
}

function toUniqueContacts(input: DecisionMakerContact[]) {
  const seen = new Set<string>();
  const output: DecisionMakerContact[] = [];
  for (const contact of input) {
    const key = (contact.email || `${contact.fullName}:${contact.title || ""}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(contact);
  }
  return output;
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

async function searchDecisionMakersFromSerper(companyName: string, domain: string | null) {
  if (!process.env.SERPER_API_KEY) return [];

  // Primary: LinkedIn profile search
  const linkedinQuery = domain
    ? `site:linkedin.com/in "${companyName}" (administrator OR "executive director" OR "social services" OR "case manager" OR "discharge planner" OR "director of nursing" OR admissions OR "transportation coordinator" OR operations)`
    : `"${companyName}" (administrator OR "executive director" OR "social services" OR "case manager" OR "director of nursing" OR "admissions director" OR "office manager") site:linkedin.com/in`;

  // Secondary: general title search
  const generalQuery = `"${companyName}" (administrator OR "executive director" OR director OR manager) ("social services" OR "case management" OR admissions OR nursing OR operations OR transportation)`;

  const [linkedinResults, generalResults] = await Promise.all([
    serperSearch(linkedinQuery),
    serperSearch(generalQuery),
  ]);

  const contacts: DecisionMakerContact[] = [];

  for (const result of linkedinResults.slice(0, 10)) {
    const isLinkedin = isLinkedinProfileUrl(result.link);
    const fullName = isLinkedin
      ? extractNameFromLinkedinTitle(result.title)
      : null;
    if (!fullName) continue;

    const { firstName, lastName } = splitName(fullName);
    const titleFromPageTitle = extractTitleFromLinkedinTitle(result.title);
    const titleFromSnippet = extractTitleFromSnippet(result.snippet);
    const title = titleFromPageTitle ?? titleFromSnippet;

    contacts.push({
      firstName,
      lastName,
      fullName,
      title,
      department: titleToDepartment(title),
      email: null,
      phone: null,
      linkedinUrl: isLinkedin ? (result.link ?? null) : null,
      confidenceScore: title ? 0.65 : 0.52,
      source: "serper_linkedin",
    });
  }

  // From general results, try to extract names from snippets mentioning specific people
  for (const result of generalResults.slice(0, 6)) {
    if (isLinkedinProfileUrl(result.link)) continue; // already handled above
    const titleFromSnippet = extractTitleFromSnippet(result.snippet);
    if (!titleFromSnippet) continue;

    // Look for a name pattern near the title in the snippet
    const nameMatch = result.snippet?.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/);
    if (!nameMatch?.[1]) continue;
    const fullName = nameMatch[1];

    contacts.push({
      ...splitName(fullName),
      fullName,
      title: titleFromSnippet,
      department: titleToDepartment(titleFromSnippet),
      email: null,
      phone: null,
      linkedinUrl: null,
      confidenceScore: 0.45,
      source: "serper_web",
    });
  }

  return contacts;
}

// ---------------------------------------------------------------------------
// Apollo.io — two-step: search (free) then enrich (1 credit each)
// ---------------------------------------------------------------------------

// Titles we target for decision-maker discovery. The ICP is NEMT
// (non-emergency medical transportation): the people who decide which
// transport company a facility calls are administrators, social services /
// case management staff (who book the rides), and operations leadership.
const APOLLO_TARGET_TITLES = [
  // Facility leadership — signs vendor agreements
  "Administrator",
  "Facility Administrator",
  "Executive Director",
  "Chief Operating Officer",
  "COO",
  "Director of Operations",
  "Operations Manager",
  "Chief Administrative Officer",
  "Administrative Director",
  // The people who actually book patient transport
  "Director of Social Services",
  "Social Services Director",
  "Social Worker",
  "Case Manager",
  "Director of Case Management",
  "Discharge Planner",
  "Transportation Coordinator",
  "Transportation Manager",
  "Activities Director",
  // Clinical & admissions leadership involved in transport decisions
  "Director of Nursing",
  "Director of Admissions",
  "Admissions Director",
  "Admissions Coordinator",
  // Clinic-scale decision makers
  "Office Manager",
  "Clinic Manager",
  "Practice Manager",
  "Clinic Administrator",
];

type ApolloSearchPerson = {
  id: string;
  first_name: string;
  last_name_obfuscated?: string;
  title?: string;
  has_email?: boolean;
  has_direct_phone?: string;
  linkedin_url?: string;
  organization?: { name?: string };
};

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

async function searchPeopleFromApollo(
  companyName: string,
  domain: string | null,
): Promise<ApolloSearchPerson[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return [];

  try {
    const body: Record<string, unknown> = {
      q_organization_name: companyName,
      person_titles: APOLLO_TARGET_TITLES,
      per_page: 10,
      page: 1,
    };
    if (domain) body.q_organization_domains = [domain];

    const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as { people?: ApolloSearchPerson[] };
    return payload.people ?? [];
  } catch {
    return [];
  }
}

async function enrichPersonFromApollo(apolloId: string): Promise<ApolloEnrichedPerson | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        id: apolloId,
        reveal_personal_emails: false,
        reveal_phone_number: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { person?: ApolloEnrichedPerson };
    return payload.person ?? null;
  } catch {
    return null;
  }
}

// Max contacts to enrich per company — each costs 1 Apollo credit
const APOLLO_MAX_ENRICH = 5;

async function searchDecisionMakersFromApollo(
  companyName: string,
  domain: string | null,
): Promise<DecisionMakerContact[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return [];

  // Step 1: search (free, no credits)
  const people = await searchPeopleFromApollo(companyName, domain);
  if (!people.length) return [];

  // Step 2: enrich only people who have an email on file (saves credits)
  const enrichable = people.filter((p) => p.has_email).slice(0, APOLLO_MAX_ENRICH);

  // If none have emails, still return basic info from search results
  if (!enrichable.length) {
    return people.slice(0, APOLLO_MAX_ENRICH).map((p) => ({
      firstName: p.first_name,
      lastName: null,
      fullName: p.first_name,
      title: p.title ?? null,
      department: titleToDepartment(p.title ?? null),
      email: null,
      phone: null,
      linkedinUrl: p.linkedin_url ?? null,
      confidenceScore: 0.60,
      source: "apollo_search",
    }));
  }

  // Enrich sequentially (Apollo recommends sequential for stability)
  const enriched: DecisionMakerContact[] = [];

  for (const person of enrichable) {
    const full = await enrichPersonFromApollo(person.id);
    if (!full) continue;

    const fullName = full.name || [full.first_name, full.last_name].filter(Boolean).join(" ");
    if (!fullName) continue;

    const primaryPhone =
      full.phone_numbers?.find((p) => p.type === "work_direct")?.raw_number ??
      full.phone_numbers?.[0]?.raw_number ??
      null;

    enriched.push({
      firstName: full.first_name ?? person.first_name,
      lastName: full.last_name ?? null,
      fullName,
      title: full.title ?? person.title ?? null,
      department: titleToDepartment(full.title ?? person.title ?? null),
      email: full.email ?? null,
      phone: primaryPhone,
      linkedinUrl: full.linkedin_url ?? person.linkedin_url ?? null,
      confidenceScore: full.email ? 0.95 : 0.70,
      source: full.email ? "apollo_enriched" : "apollo_search",
    });
  }

  return enriched;
}

type HunterEmail = {
  value: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  phone_number: string | null;
  linkedin: string | null;
};

async function searchContactsFromHunter(domain: string | null) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || !domain) return [];

  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("limit", "10");

  let emails: HunterEmail[];
  try {
    // API key goes in a header, not the query string, so it can't leak via logs/referrers.
    const response = await fetch(url, {
      headers: { "X-API-KEY": apiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error(`Hunter domain search failed with status ${response.status}`);
      return [];
    }

    const payload = (await response.json()) as { data?: { emails?: HunterEmail[] } };
    emails = payload.data?.emails ?? [];
  } catch (error) {
    console.error("Hunter domain search failed:", error instanceof Error ? error.message : error);
    return [];
  }

  return emails.map((entry) => {
    const fullName = [entry.first_name, entry.last_name].filter(Boolean).join(" ").trim();
    return {
      firstName: entry.first_name,
      lastName: entry.last_name,
      fullName: fullName || entry.value.split("@")[0],
      title: entry.position,
      department: titleToDepartment(entry.position),
      email: entry.value,
      phone: entry.phone_number,
      linkedinUrl: entry.linkedin ?? null,
      confidenceScore: 0.84,
      source: "hunter_domain_search",
    } satisfies DecisionMakerContact;
  });
}

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

  // Reject strings that are clearly job titles, not names
  const lowerName = name.toLowerCase();
  const titleWords = [
    "operations", "supervisor", "manager", "director", "administrator",
    "coordinator", "specialist", "technician", "nurse", "nursing", "plant",
    "weekend", "regional", "assistant", "associate", "senior", "junior",
  ];
  if (titleWords.some((w) => lowerName.startsWith(w))) {
    return { firstName: null, lastName: null, fullName: null };
  }

  const firstName = parts[0] ?? null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

  return { firstName, lastName, fullName: name };
}

export type ApolloContactMatch = {
  email: string | null;
  phone: string | null;
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
      phone: primaryPhone,
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
 *   2. Hunter email finder (non-Apollo/PDL, uses Hunter credits).
 *   3. LinkedIn profile lookup via Serper (free tier of value on its own,
 *      and it sharpens the paid lookups below).
 *   4. Apollo people/match — BACKUP (requires APOLLO_PLAN_ENABLED).
 *   5. People Data Labs — BACKUP.
 *   6. Site email-pattern guess (first.last@) — last resort, clearly
 *      low-confidence and MX-verified.
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
  let phone: string | null = null;
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
      if (!sourcesUsed.includes("website")) sourcesUsed.push("website");
    }
  }

  // ---- 2. Hunter email finder (non-Apollo/PDL) ----
  const domain = input.domain ?? site?.domain ?? null;
  if (!email && firstName && lastName && domain) {
    const hunterHit = await hunterEmailFinder(firstName, lastName, domain);
    if (hunterHit) {
      email = hunterHit.email;
      emailSource = "hunter";
      confidence = Math.min(hunterHit.score / 100, 0.95);
      title = title ?? hunterHit.position;
      phone = phone ?? hunterHit.phone;
      sourcesUsed.push("hunter");
    }
  }

  // ---- 3. LinkedIn profile via Serper (free-tier value + sharpens backups) ----
  const fullNameForSearch = cleaned.fullName ?? [firstName, lastName].filter(Boolean).join(" ");
  if (!linkedinUrl && fullNameForSearch) {
    linkedinUrl = await findLinkedinForPerson(fullNameForSearch, input.organizationName);
    if (linkedinUrl) sourcesUsed.push("serper");
  }

  // ---- 4/5. Paid backups — only when the free tier didn't find an email ----
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
      phone = phone ?? backup.phone;
      title = title ?? backup.title;
      linkedinUrl = linkedinUrl ?? backup.linkedinUrl;
      confidence = Math.max(confidence, backup.confidenceScore);
      sourcesUsed.push(backup.source);
    }
  }

  // ---- 6. Last resort: pattern guess from the site's own email format ----
  if (!email && site) {
    const guessed = await inferEmailFromSitePattern(site, firstName, lastName);
    if (guessed) {
      email = guessed;
      emailSource = "email_pattern_guess";
      confidence = Math.max(confidence, 0.45);
      sourcesUsed.push("email_pattern_guess");
    }
  }

  if (!email && !phone && !linkedinUrl) return null;
  // A pre-existing LinkedIn URL alone isn't new data.
  if (!email && !phone && linkedinUrl === (input.linkedinUrl ?? null)) return null;

  return {
    email,
    phone,
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
      phone: primaryPhone,
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


export async function lookupDecisionMakers(input: LookupInput): Promise<LookupOutput> {
  const providersUsed: string[] = [];
  const resolvedWebsite = await resolveWebsite(input.companyName, input.website);
  // Only use a domain we actually resolved — a guessed "<company-slug>.com"
  // sends Hunter/Apollo lookups to domains that may belong to someone else.
  const domain = parseDomain(resolvedWebsite);

  // Run all three providers in parallel. Apollo is the primary source for
  // email + phone; Hunter fills domain-level emails; Serper adds LinkedIn names.
  const [apolloContacts, hunterContacts, serperContacts] = await Promise.all([
    searchDecisionMakersFromApollo(input.companyName, domain),
    searchContactsFromHunter(domain),
    searchDecisionMakersFromSerper(input.companyName, domain),
  ]);

  if (apolloContacts.length) providersUsed.push("apollo");
  if (hunterContacts.length) providersUsed.push("hunter");
  if (serperContacts.length) providersUsed.push("serper");

  // Build lookup maps for merging
  const apolloByName = new Map(
    apolloContacts.map((c) => [c.fullName.toLowerCase(), c]),
  );
  const serperByName = new Map(
    serperContacts.map((c) => [c.fullName.toLowerCase(), c]),
  );

  // Enrich Hunter contacts with Apollo/Serper data where names overlap
  const enrichedHunter = hunterContacts.map((contact) => {
    const apolloMatch = apolloByName.get(contact.fullName.toLowerCase());
    const serperMatch = serperByName.get(contact.fullName.toLowerCase());
    return {
      ...contact,
      phone: contact.phone || apolloMatch?.phone || null,
      title: contact.title || apolloMatch?.title || serperMatch?.title || null,
      department: contact.department || apolloMatch?.department || serperMatch?.department || null,
      linkedinUrl: contact.linkedinUrl || apolloMatch?.linkedinUrl || serperMatch?.linkedinUrl || null,
      confidenceScore: Math.max(
        contact.confidenceScore,
        apolloMatch?.confidenceScore ?? 0,
        serperMatch?.confidenceScore ?? 0,
      ),
      source: apolloMatch ? "apollo+hunter" : (serperMatch ? "hunter+serper" : contact.source),
    };
  });

  // Apollo contacts not already in Hunter (by email or name)
  const hunterEmails = new Set(enrichedHunter.map((c) => c.email?.toLowerCase()).filter(Boolean));
  const hunterNames = new Set(enrichedHunter.map((c) => c.fullName.toLowerCase()));
  const apolloOnly = apolloContacts.filter(
    (c) =>
      !(c.email && hunterEmails.has(c.email.toLowerCase())) &&
      !hunterNames.has(c.fullName.toLowerCase()),
  );

  // Serper contacts not already covered
  const allNames = new Set([
    ...enrichedHunter.map((c) => c.fullName.toLowerCase()),
    ...apolloOnly.map((c) => c.fullName.toLowerCase()),
  ]);
  const serperOnly = serperContacts.filter((c) => !allNames.has(c.fullName.toLowerCase()));

  // Apollo first (highest confidence), then Hunter, then Serper
  const merged = toUniqueContacts([...apolloOnly, ...enrichedHunter, ...serperOnly]).slice(0, 10);

  return {
    resolvedWebsite,
    contacts: merged,
    providersUsed,
  };
}
