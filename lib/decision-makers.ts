type DecisionMakerContact = {
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
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

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = value.startsWith("http") ? value : `https://${value}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function titleToDepartment(title: string | null) {
  if (!title) return null;
  const normalized = title.toLowerCase();
  if (normalized.includes("logistics")) return "Logistics";
  if (normalized.includes("supply chain")) return "Supply Chain";
  if (normalized.includes("operations")) return "Operations";
  if (normalized.includes("procurement")) return "Procurement";
  return null;
}

function splitName(fullName: string) {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: cleaned, lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function extractNameFromTitle(title: string | undefined) {
  if (!title) return null;
  const base = title.split("|")[0]?.split("-")[0]?.trim();
  if (!base || base.length < 4) return null;
  if (base.toLowerCase().includes("linkedin")) return null;
  return base;
}

function extractTitleFromSnippet(snippet: string | undefined) {
  if (!snippet) return null;
  const match =
    snippet.match(
      /\b(?:director|vp|vice president|head|manager|chief|coo|operations|supply chain|logistics)[^.,;]{0,80}/i,
    ) ?? null;
  return match ? match[0].trim() : null;
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

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ q: query, num: 8 }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { organic?: SerperResult[] };
  return payload.organic ?? [];
}

async function resolveWebsite(companyName: string, providedWebsite?: string | null) {
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

  const query = domain
    ? `site:linkedin.com/in ("${companyName}" OR "${domain}") ("operations manager" OR "director of operations" OR "supply chain" OR "logistics manager" OR "vp operations")`
    : `"${companyName}" ("operations manager" OR "director of operations" OR "supply chain" OR "logistics manager") linkedin`;

  const results = await serperSearch(query);
  const contacts: DecisionMakerContact[] = [];

  for (const result of results.slice(0, 8)) {
    const fullName = extractNameFromTitle(result.title);
    if (!fullName) continue;
    const { firstName, lastName } = splitName(fullName);
    const title = extractTitleFromSnippet(result.snippet);

    contacts.push({
      firstName,
      lastName,
      fullName,
      title,
      department: titleToDepartment(title),
      email: null,
      phone: null,
      confidenceScore: 0.58,
      source: "serper_search",
    });
  }

  return contacts;
}

type HunterEmail = {
  value: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  phone_number: string | null;
};

async function searchContactsFromHunter(domain: string | null) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || !domain) return [];

  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("limit", "10");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return [];

  const payload = (await response.json()) as { data?: { emails?: HunterEmail[] } };
  const emails = payload.data?.emails ?? [];

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
      confidenceScore: 0.84,
      source: "hunter_domain_search",
    } satisfies DecisionMakerContact;
  });
}

export async function lookupDecisionMakers(input: LookupInput): Promise<LookupOutput> {
  const providersUsed: string[] = [];
  const resolvedWebsite = await resolveWebsite(input.companyName, input.website);
  const domain = parseDomain(resolvedWebsite) || `${slugify(input.companyName)}.com`;

  const [hunterContacts, serperContacts] = await Promise.all([
    searchContactsFromHunter(domain),
    searchDecisionMakersFromSerper(input.companyName, domain),
  ]);

  if (hunterContacts.length) providersUsed.push("hunter");
  if (serperContacts.length) providersUsed.push("serper");

  const serperByName = new Map(
    serperContacts.map((contact) => [contact.fullName.toLowerCase(), contact]),
  );

  const mergedFromHunter = hunterContacts.map((contact) => {
    const byName = serperByName.get(contact.fullName.toLowerCase());
    return {
      ...contact,
      phone: contact.phone || byName?.phone || null,
      title: contact.title || byName?.title || null,
      department: contact.department || byName?.department || null,
      confidenceScore: Math.max(contact.confidenceScore, byName?.confidenceScore || 0),
      source: byName ? "hunter+serper" : contact.source,
    };
  });

  const merged = toUniqueContacts([...mergedFromHunter, ...serperContacts]).slice(0, 8);

  return {
    resolvedWebsite: resolvedWebsite ?? `https://${domain}`,
    contacts: merged,
    providersUsed,
  };
}
