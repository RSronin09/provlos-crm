// ---------------------------------------------------------------------------
// Instantly.ai — SuperSearch lead finder + lead-list retrieval
//
// Scaffolding only: every function below checks for INSTANTLY_API_KEY and
// returns a safe empty/null value when it's not set, exactly like the other
// providers in lib/decision-makers.ts and lib/discovery.ts. Once
// INSTANTLY_API_KEY is added to the environment, everything here goes live
// with no other code changes required.
//
// Docs: https://developer.instantly.ai/api-reference/groups/supersearch-enrichment
// ---------------------------------------------------------------------------

import {
  FLORIDA_COUNTY_CITIES,
  HEALTHCARE_FACILITY_TITLES,
  INSTANTLY_HEALTHCARE_SUB_INDUSTRIES,
  type InstantlyEmployeeCountBracket,
} from "@/lib/instantly-constants";

// Overridable so the integration can be tested against a mock server.
const INSTANTLY_API_BASE = process.env.INSTANTLY_API_BASE ?? "https://api.instantly.ai/api/v2";

// Re-exported for backwards-compatible imports — the canonical source of
// truth for these constants is lib/instantly-constants.ts (kept dependency-free
// so client components can import it directly without pulling in server code).
export {
  INSTANTLY_INDUSTRIES,
  INSTANTLY_HEALTHCARE_SUB_INDUSTRIES,
  INSTANTLY_EMPLOYEE_COUNT_BRACKETS,
  INSTANTLY_LEVELS,
  FLORIDA_COUNTY_CITIES,
  HEALTHCARE_FACILITY_TITLES,
  HEALTHCARE_FACILITY_KEYWORDS,
} from "@/lib/instantly-constants";
export type {
  InstantlyIndustry,
  InstantlyEmployeeCountBracket,
  InstantlyLevel,
} from "@/lib/instantly-constants";

// ---------------------------------------------------------------------------
// Types — mirrors the documented SuperSearch `search_filters` schema
// ---------------------------------------------------------------------------

/** Location filter — either a Google Maps Place ID (most precise, e.g. county-level)
 *  or a plain city/state/country combo (no Google Places API dependency required). */
export type InstantlyLocation =
  | { place_id: string; label?: string }
  | { city?: string; state?: string; country?: string };

export type InstantlyIncludeExclude<T> = { include?: T[]; exclude?: T[] };

export type InstantlySearchFilters = {
  locations?: InstantlyLocation[] | InstantlyIncludeExclude<InstantlyLocation>;
  location_mode?: "contact" | "company";
  industry?: InstantlyIncludeExclude<string>;
  subIndustry?: InstantlyIncludeExclude<string>;
  title?: InstantlyIncludeExclude<string>;
  department?: string[];
  level?: string[];
  employeeCount?: (InstantlyEmployeeCountBracket | { op: "gte" | "lte" | "between"; min?: number; max?: number })[];
  company_name?: InstantlyIncludeExclude<string>;
  keyword_filter?: { include?: string; exclude?: string };
  look_alike?: string;
  skip_owned_leads?: boolean;
  show_one_lead_per_company?: boolean;
};

/** A single result row from the preview endpoint (no email/phone — those are
 *  only revealed once a lead is actually enriched into a list, since email
 *  reveals cost credits). */
export type InstantlyPreviewLead = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  location?: string;
  linkedIn?: string;
  companyName?: string;
  companyLogo?: string;
  companyId?: string;
};

/** A fully-enriched lead once it's landed in a list (post `enrichLeadsFromSuperSearch`). */
export type InstantlyEnrichedLead = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  website?: string | null;
  phone?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

// Per the OpenAPI spec, both count and preview return the match total in
// `number_of_leads`. (`total_result_count` never existed in the API — reading
// it made every count display as zero regardless of actual matches.)
type PreviewResponse = {
  leads?: InstantlyPreviewLead[];
  number_of_leads?: number;
  number_of_redacted_results?: number;
};

type CountResponse = {
  number_of_leads?: number;
};

type EnrichResponse = {
  id?: string;
  resource_id?: string;
  resource_type?: number;
  list_name?: string;
  limit?: number;
  background_job_id?: string | null;
};

type LeadsListResponse = {
  items?: InstantlyEnrichedLead[];
};

// ---------------------------------------------------------------------------
// Core HTTP client
// ---------------------------------------------------------------------------

function isConfigured(): boolean {
  return !!process.env.INSTANTLY_API_KEY;
}

async function instantlyRequest<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "INSTANTLY_API_KEY is not configured." };
  }

  try {
    const response = await fetch(`${INSTANTLY_API_BASE}${path}`, {
      method: options.method ?? "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 401) {
      return { ok: false, error: "Instantly rejected the API key (401 Unauthorized).", status: 401 };
    }
    if (response.status === 402) {
      return {
        ok: false,
        error: "Instantly workspace does not have an active paid plan (402 Payment Required).",
        status: 402,
      };
    }
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      return { ok: false, error: `Instantly request failed (${response.status}): ${details.slice(0, 300)}`, status: response.status };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown network error" };
  }
}

// ---------------------------------------------------------------------------
// SuperSearch — count / preview / enrich
// ---------------------------------------------------------------------------

/** Free — returns how many leads match the filters. Use this before spending
 *  credits on `enrichLeadsFromSuperSearch`. */
export async function countLeadsFromSuperSearch(
  filters: InstantlySearchFilters,
): Promise<{ ok: boolean; count: number; error?: string }> {
  const result = await instantlyRequest<CountResponse>("/supersearch-enrichment/count-leads-from-supersearch", {
    body: { search_filters: filters },
  });
  if (!result.ok) return { ok: false, count: 0, error: result.error };
  return { ok: true, count: result.data.number_of_leads ?? 0 };
}

/** Free — returns a sample of matching leads (name, title, company, LinkedIn —
 *  no email/phone yet) so filters can be sanity-checked before enriching. */
export async function previewLeadsFromSuperSearch(
  filters: InstantlySearchFilters,
): Promise<{ ok: boolean; leads: InstantlyPreviewLead[]; totalCount: number; error?: string }> {
  const result = await instantlyRequest<PreviewResponse>("/supersearch-enrichment/preview-leads-from-supersearch", {
    body: { search_filters: filters },
  });
  if (!result.ok) return { ok: false, leads: [], totalCount: 0, error: result.error };
  return {
    ok: true,
    leads: result.data.leads ?? [],
    totalCount: result.data.number_of_leads ?? result.data.leads?.length ?? 0,
  };
}

/** Costs credits. Kicks off an import of matching leads (with verified email)
 *  into a new or existing Instantly list. This runs as a background job on
 *  Instantly's side — poll `getEnrichmentStatus` or just wait a few minutes,
 *  then call `listLeadsInList` to pull the enriched contacts back. */
export async function enrichLeadsFromSuperSearch(params: {
  filters: InstantlySearchFilters;
  limit: number;
  listName?: string;
  resourceId?: string;
  skipRowsWithoutEmail?: boolean;
}): Promise<{ ok: boolean; resourceId?: string; backgroundJobId?: string | null; listName?: string; error?: string }> {
  const result = await instantlyRequest<EnrichResponse>("/supersearch-enrichment/enrich-leads-from-supersearch", {
    body: {
      search_filters: params.filters,
      limit: params.limit,
      list_name: params.listName,
      resource_id: params.resourceId,
      skip_rows_without_email: params.skipRowsWithoutEmail ?? true,
    },
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    resourceId: result.data.resource_id,
    backgroundJobId: result.data.background_job_id ?? null,
    listName: result.data.list_name,
  };
}

/** Poll this after `enrichLeadsFromSuperSearch` to check whether the
 *  background import job has finished landing leads in the target list. */
export async function getEnrichmentStatus(
  resourceId: string,
): Promise<{ ok: boolean; data?: EnrichResponse; error?: string }> {
  const result = await instantlyRequest<EnrichResponse>(`/supersearch-enrichment/${resourceId}`, { method: "GET" });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

/** Fetches the actual lead records (with email/phone once enrichment has
 *  completed) that live in an Instantly list. */
export async function listLeadsInList(
  listId: string,
  opts: { limit?: number } = {},
): Promise<{ ok: boolean; leads: InstantlyEnrichedLead[]; error?: string }> {
  const result = await instantlyRequest<LeadsListResponse>("/leads/list", {
    body: { list_id: listId, limit: opts.limit ?? 100 },
  });
  if (!result.ok) return { ok: false, leads: [], error: result.error };
  return { ok: true, leads: result.data.items ?? [] };
}

// ---------------------------------------------------------------------------
// Convenience helpers for the "healthcare facilities by county" use case
// ---------------------------------------------------------------------------

export function buildHealthcareCountySearchFilters(options: {
  counties: string[];
  keywordInclude?: string;
  keywordExclude?: string;
  titles?: string[];
  employeeCount?: InstantlyEmployeeCountBracket[];
  locationMode?: "contact" | "company";
}): InstantlySearchFilters {
  const locations: InstantlyLocation[] = options.counties.flatMap((county) => {
    const cities = FLORIDA_COUNTY_CITIES[county];
    if (!cities) {
      // Unknown county label — fall back to treating it as a plain state/city string.
      return [{ city: county, state: "Florida", country: "United States" } satisfies InstantlyLocation];
    }
    return cities.map((city) => ({ city, state: "Florida", country: "United States" }) satisfies InstantlyLocation);
  });

  // keyword_filter is a single literal string on Instantly's side (no OR
  // syntax) and every filter here is ANDed together, so it is omitted unless
  // explicitly provided — sending a joined keyword list used to zero out
  // every search.
  const keywordInclude = options.keywordInclude?.trim();
  const keywordExclude = options.keywordExclude?.trim();
  const keyword_filter =
    keywordInclude || keywordExclude
      ? {
          ...(keywordInclude ? { include: keywordInclude } : {}),
          ...(keywordExclude ? { exclude: keywordExclude } : {}),
        }
      : undefined;

  const titles = options.titles ?? HEALTHCARE_FACILITY_TITLES;

  return {
    // Object include/exclude form — the plain-array form is documented as legacy.
    locations: { include: locations },
    location_mode: options.locationMode ?? "company",
    industry: { include: ["Healthcare, Pharmaceuticals, & Biotech"] },
    subIndustry: { include: [...INSTANTLY_HEALTHCARE_SUB_INDUSTRIES] },
    ...(titles.length ? { title: { include: titles } } : {}),
    ...(keyword_filter ? { keyword_filter } : {}),
    employeeCount: options.employeeCount,
    show_one_lead_per_company: true,
    skip_owned_leads: true,
  };
}

/** One relaxation step in a zero-match diagnosis. */
export type DiagnosisStep = {
  key: string;
  label: string;
  count: number | null;
  error?: string;
};

/**
 * Pinpoints which filter is zeroing out a SuperSearch by re-running the
 * (free) count with progressively fewer filters. Steps are cumulative: each
 * one removes an additional filter, so the first step with matches identifies
 * the filter that eliminated everything.
 */
export async function diagnoseSearchFilters(full: InstantlySearchFilters): Promise<DiagnosisStep[]> {
  const variants: { key: string; label: string; filters: InstantlySearchFilters }[] = [
    { key: "full", label: "All filters as configured", filters: full },
  ];

  let current = full;

  if (current.keyword_filter) {
    current = { ...current };
    delete current.keyword_filter;
    variants.push({ key: "no_keyword", label: "Without the keyword filter", filters: current });
  }

  if (current.title) {
    current = { ...current };
    delete current.title;
    variants.push({ key: "no_titles", label: "Also without job titles", filters: current });
  }

  if (current.subIndustry) {
    current = { ...current };
    delete current.subIndustry;
    variants.push({
      key: "no_sub_industry",
      label: "Also without healthcare sub-industries (industry only)",
      filters: current,
    });
  }

  if (current.location_mode === "company") {
    variants.push({
      key: "contact_location",
      label: "Same, but matching the person's location instead of company HQ",
      filters: { ...current, location_mode: "contact" },
    });
  }

  if (current.locations) {
    const noLocation = { ...current };
    delete noLocation.locations;
    variants.push({
      key: "no_location",
      label: "Also without any location filter (sanity check)",
      filters: noLocation,
    });
  }

  const steps: DiagnosisStep[] = [];
  // Sequential on purpose — these are free count calls, but there's no need
  // to hammer the API in parallel.
  for (const variant of variants) {
    const result = await countLeadsFromSuperSearch(variant.filters);
    steps.push({
      key: variant.key,
      label: variant.label,
      count: result.ok ? result.count : null,
      ...(result.ok ? {} : { error: result.error }),
    });
  }

  return steps;
}

/** Maps a preview-stage Instantly lead (no email yet) into a human-readable
 *  candidate shape that's easy to render in the UI or drop into
 *  LeadCandidate.notes when promoting to the CRM. */
export function describePreviewLead(lead: InstantlyPreviewLead): string {
  const parts = [
    lead.fullName ?? [lead.firstName, lead.lastName].filter(Boolean).join(" "),
    lead.jobTitle,
    lead.companyName,
    lead.location,
  ].filter(Boolean);
  return parts.join(" — ");
}

/** Resolves the convenience { counties, keyword filters, titles, employeeCount }
 *  request shape used by the discovery API routes into full search filters,
 *  falling back to a caller-supplied raw `filters` object if provided. */
export function resolveSearchFilters(input: {
  counties?: string[];
  keywordInclude?: string;
  keywordExclude?: string;
  titles?: string[];
  employeeCount?: string[];
  locationMode?: "contact" | "company";
  filters?: InstantlySearchFilters;
}): InstantlySearchFilters {
  if (input.filters) return input.filters;

  return buildHealthcareCountySearchFilters({
    counties: input.counties?.length ? input.counties : Object.keys(FLORIDA_COUNTY_CITIES),
    keywordInclude: input.keywordInclude,
    keywordExclude: input.keywordExclude,
    titles: input.titles,
    employeeCount: input.employeeCount as InstantlyEmployeeCountBracket[] | undefined,
    locationMode: input.locationMode,
  });
}

export { isConfigured as isInstantlyConfigured };
