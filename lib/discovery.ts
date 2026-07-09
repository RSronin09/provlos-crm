import { parseDomain, slugify } from "@/lib/text";

type LeadCandidateInput = {
  companyName: string;
  website: string | null;
  state: string | null;
  region: string | null;
  signalType: string | null;
  signalSummary: string | null;
  sourceUrl: string | null;
  sourcePublishedAt: Date | null;
  confidenceScore: number;
  dedupeKey: string;
  notes: string | null;
};

type SerperOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
};

function detectSignalType(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.match(/\bhir(ing|ed)\b|\bjob posting|career|open position/)) return "hiring";
  if (normalized.match(/\bexpan(d|sion|ding)\b|\bnew (office|location|market|facility)/)) return "expansion";
  if (normalized.match(/\bcontract|awarded|won (a|the)\b|\bpartnership|agreement/)) return "contract";
  if (normalized.match(/\bfunding|series [a-e]\b|\binvest(ment|or)|raise[sd]?\b/)) return "funding";
  if (normalized.match(/\blaunch(ed|ing)?\b|\bnew (product|service|solution)/)) return "launch";
  return "operations";
}

function extractDateFromResult(result: SerperOrganicResult): Date | null {
  if (!result.date) return null;
  try {
    const parsed = new Date(result.date);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {
    // ignore
  }
  return null;
}

async function serperSearch(query: string): Promise<SerperOrganicResult[]> {
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
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { organic?: SerperOrganicResult[] };
    return payload.organic ?? [];
  } catch {
    return [];
  }
}

function extractCompanyName(title: string | undefined): string | null {
  if (!title) return null;
  // Remove common suffixes
  const cleaned = title
    .replace(/\s*[-|–—]\s*.+$/, "")
    .replace(/\b(Inc\.?|LLC|Corp\.?|Ltd\.?|Co\.?|Company|Group|Holdings?)\s*$/i, "")
    .trim();
  if (cleaned.length < 3 || cleaned.length > 80) return null;
  return cleaned;
}

function buildDedupeKey(companyName: string, state: string | null, region: string | null): string {
  return `${slugify(companyName)}:${state ?? "na"}:${region ?? "na"}`;
}

/**
 * Uses Serper web search to find companies that match the query + geography filters.
 * Falls back to a small set of illustrative placeholders if no API key is configured.
 */
export async function buildLeadCandidates(
  query: string,
  state?: string | null,
  region?: string | null,
): Promise<LeadCandidateInput[]> {
  const candidates: LeadCandidateInput[] = [];
  const seen = new Set<string>();

  if (process.env.SERPER_API_KEY) {
    // Build a targeted search query combining the signal query with optional geo
    const geoSuffix = [state, region].filter(Boolean).join(" ");
    const searches = [
      `${query}${geoSuffix ? " " + geoSuffix : ""} company courier delivery logistics`,
      `${query}${geoSuffix ? " " + geoSuffix : ""} distribution operations`,
    ];

    for (const searchQuery of searches) {
      const results = await serperSearch(searchQuery);

      for (const result of results) {
        const link = result.link ?? "";
        const domain = parseDomain(link, { excludeSocial: true });
        if (!domain) continue;

        // Skip generic info sites
        if (/yelp|yellowpages|bbb\.org|indeed|glassdoor|manta|dnb\.com|bizbuysell/.test(domain)) continue;

        const companyName = extractCompanyName(result.title);
        if (!companyName) continue;

        const dedupeKey = buildDedupeKey(companyName, state ?? null, region ?? null);
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const signalType = detectSignalType(`${result.title ?? ""} ${result.snippet ?? ""}`);
        const summary = result.snippet
          ? result.snippet.slice(0, 300)
          : `Found via search: "${query}".`;

        candidates.push({
          companyName,
          website: link || `https://${domain}`,
          state: state ?? null,
          region: region ?? null,
          signalType,
          signalSummary: summary,
          sourceUrl: link || null,
          sourcePublishedAt: extractDateFromResult(result),
          confidenceScore: 0.65,
          dedupeKey,
          notes: null,
        });

        if (candidates.length >= 12) break;
      }

      if (candidates.length >= 12) break;
    }
  }

  // If Serper returned nothing (no key or no results), return empty — caller handles it gracefully
  return candidates;
}
