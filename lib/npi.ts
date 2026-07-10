// ---------------------------------------------------------------------------
// NPPES NPI Registry — the U.S. government's registry of every healthcare
// organization (CMS). Free, no API key, no rate-limit headaches, and it
// includes an "authorized official" (name + title + phone) for every
// facility — i.e. a decision-maker contact straight from the source.
//
// This is the primary lead source for the healthcare-courier ICP: instead of
// scraping search results or paying per-contact for third-party B2B data
// (which is thin for small facilities), we enumerate the actual licensed
// facility universe in the target geography, then spend paid enrichment
// credits only on finding email addresses.
//
// Docs: https://npiregistry.cms.hhs.gov/api-page
// ---------------------------------------------------------------------------

import { FLORIDA_COUNTY_CITIES } from "@/lib/instantly-constants";

const NPI_API_BASE = "https://npiregistry.cms.hhs.gov/api/";

/** How facility types map to NPI taxonomy searches, plus courier-sales
 *  context that gets written onto imported accounts. */
export type FacilityTypePreset = {
  key: string;
  label: string;
  /** Passed to the API's taxonomy_description param (partial match). */
  taxonomyQuery: string;
  whatTheyMove: string;
  whyHireCouriers: string;
  /** Selected by default in the UI. */
  defaultSelected: boolean;
};

export const FACILITY_TYPE_PRESETS: FacilityTypePreset[] = [
  {
    key: "snf",
    label: "Skilled Nursing Facility",
    taxonomyQuery: "Skilled Nursing Facility",
    whatTheyMove: "Pharmacy medications, STAT lab specimens, medical records, wound-care and nursing supplies",
    whyHireCouriers: "Daily pharmacy runs and same-day STAT specimen pickups; no in-house transport staff",
    defaultSelected: true,
  },
  {
    key: "alf",
    label: "Assisted Living Facility",
    taxonomyQuery: "Assisted Living Facility",
    whatTheyMove: "Resident medications, incontinence and care supplies, documents",
    whyHireCouriers: "Recurring pharmacy deliveries for residents; small staff with no drivers",
    defaultSelected: true,
  },
  {
    key: "home_health",
    label: "Home Health Agency",
    taxonomyQuery: "Home Health",
    whatTheyMove: "Medical supplies and equipment to patient homes, specimen pickups from the field",
    whyHireCouriers: "Distributed patient base needs scheduled and on-demand home deliveries",
    defaultSelected: true,
  },
  {
    key: "hospice",
    label: "Hospice",
    taxonomyQuery: "Hospice",
    whatTheyMove: "Comfort kits, medications, and supplies to patient homes and inpatient units",
    whyHireCouriers: "Time-critical medication deliveries to patients across the service area",
    defaultSelected: true,
  },
  {
    key: "dialysis",
    label: "Dialysis Center (ESRD)",
    taxonomyQuery: "End-Stage Renal Disease",
    whatTheyMove: "Lab specimens on fixed schedules, dialysate and clinic supplies",
    whyHireCouriers: "Recurring specimen routes to reference labs multiple times per week",
    defaultSelected: true,
  },
  {
    key: "adult_day",
    label: "Adult Day Care",
    taxonomyQuery: "Adult Day Care",
    whatTheyMove: "Participant medications, activity and care supplies",
    whyHireCouriers: "Small operations without vehicles for supply and pharmacy runs",
    defaultSelected: true,
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    taxonomyQuery: "Pharmacy",
    whatTheyMove: "Prescription deliveries to facilities and patient homes",
    whyHireCouriers: "Outsource last-mile prescription delivery instead of running their own drivers",
    defaultSelected: false,
  },
  {
    key: "lab",
    label: "Clinical Laboratory",
    taxonomyQuery: "Clinical Medical Laboratory",
    whatTheyMove: "Specimen pickups from facilities and draw sites, report/records delivery",
    whyHireCouriers: "Daily specimen logistics routes between clients and the lab",
    defaultSelected: false,
  },
  {
    key: "dme",
    label: "Durable Medical Equipment",
    taxonomyQuery: "Durable Medical Equipment",
    whatTheyMove: "Medical equipment and supplies delivered/set up at patient homes",
    whyHireCouriers: "Home delivery capacity without maintaining a delivery fleet",
    defaultSelected: false,
  },
];

export type NpiFacility = {
  npi: string;
  /** DBA name when available, otherwise the legal name (title-cased). */
  organizationName: string;
  legalName: string;
  facilityType: string;
  facilityTypeKey: string;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  county: string | null;
  authorizedOfficial: {
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    title: string | null;
    phone: string | null;
  } | null;
};

type NpiApiResult = {
  number: string;
  basic?: {
    organization_name?: string;
    status?: string;
    authorized_official_first_name?: string;
    authorized_official_last_name?: string;
    authorized_official_title_or_position?: string;
    authorized_official_telephone_number?: string;
  };
  addresses?: {
    address_purpose?: string;
    address_1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    telephone_number?: string;
  }[];
  other_names?: { organization_name?: string; type?: string }[];
  taxonomies?: { desc?: string; primary?: boolean }[];
};

/** NPPES stores everything in ALL CAPS — make it readable. */
export function titleCase(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    // Keep common abbreviations upper-cased (LLC, II, of, and)
    .replace(/\b(Llc|Llp|Inc|Pa|Pl|Ii|Iii|Iv|Dba|Snf|Alf|Cpr|Hiv|Usa)\b/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|The|At|For|On)\b/g, (m) => m.toLowerCase())
    .replace(/^([a-z])/, (c) => c.toUpperCase());
}

function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function cityToCounty(city: string | null): string | null {
  if (!city) return null;
  const normalized = city.toLowerCase();
  for (const [county, cities] of Object.entries(FLORIDA_COUNTY_CITIES)) {
    if (cities.some((c) => c.toLowerCase() === normalized)) return county;
  }
  return null;
}

function mapResult(result: NpiApiResult, preset: FacilityTypePreset): NpiFacility | null {
  const basic = result.basic;
  if (!basic?.organization_name) return null;
  // "A" = active; skip deactivated records
  if (basic.status && basic.status !== "A") return null;

  const location =
    result.addresses?.find((a) => a.address_purpose === "LOCATION") ?? result.addresses?.[0];

  const dba = result.other_names?.find(
    (n) => n.organization_name && /doing business as/i.test(n.type ?? ""),
  )?.organization_name;

  const officialFirst = titleCase(basic.authorized_official_first_name);
  const officialLast = titleCase(basic.authorized_official_last_name);
  const officialFull = [officialFirst, officialLast].filter(Boolean).join(" ");

  const primaryTaxonomy =
    result.taxonomies?.find((t) => t.primary)?.desc ?? result.taxonomies?.[0]?.desc;

  return {
    npi: result.number,
    organizationName: titleCase(dba ?? basic.organization_name) ?? basic.organization_name,
    legalName: titleCase(basic.organization_name) ?? basic.organization_name,
    facilityType: primaryTaxonomy ?? preset.label,
    facilityTypeKey: preset.key,
    address1: titleCase(location?.address_1) ?? null,
    city: titleCase(location?.city) ?? null,
    state: location?.state ?? null,
    zip: location?.postal_code?.slice(0, 5) ?? null,
    phone: formatPhone(location?.telephone_number),
    county: cityToCounty(titleCase(location?.city)),
    authorizedOfficial: officialFull
      ? {
          firstName: officialFirst,
          lastName: officialLast,
          fullName: officialFull,
          title: titleCase(basic.authorized_official_title_or_position),
          phone: formatPhone(basic.authorized_official_telephone_number),
        }
      : null,
  };
}

async function npiQuery(params: URLSearchParams): Promise<NpiApiResult[]> {
  params.set("version", "2.1");
  params.set("enumeration_type", "NPI-2"); // organizations only
  params.set("limit", "200");

  const response = await fetch(`${NPI_API_BASE}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`NPI registry request failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { result_count?: number; results?: NpiApiResult[]; Errors?: { description?: string }[] };
  if (payload.Errors?.length) {
    throw new Error(payload.Errors[0]?.description ?? "NPI registry rejected the query");
  }
  return payload.results ?? [];
}

// Serverless functions have tight time budgets; cap the number of
// city × facility-type queries per request and run a few in parallel.
const MAX_QUERIES_PER_SEARCH = 60;
const CONCURRENCY = 6;

export async function searchNpiFacilities(input: {
  cities: string[];
  state: string;
  facilityTypeKeys: string[];
}): Promise<{ facilities: NpiFacility[]; queriesRun: number; queriesCapped: boolean }> {
  const presets = FACILITY_TYPE_PRESETS.filter((p) => input.facilityTypeKeys.includes(p.key));

  const combos: { city: string; preset: FacilityTypePreset }[] = [];
  for (const preset of presets) {
    for (const city of input.cities) {
      combos.push({ city, preset });
    }
  }
  const capped = combos.length > MAX_QUERIES_PER_SEARCH;
  const toRun = combos.slice(0, MAX_QUERIES_PER_SEARCH);

  const byNpi = new Map<string, NpiFacility>();

  for (let i = 0; i < toRun.length; i += CONCURRENCY) {
    const batch = toRun.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ({ city, preset }) => {
        const params = new URLSearchParams();
        params.set("taxonomy_description", preset.taxonomyQuery);
        params.set("city", city);
        params.set("state", input.state);
        try {
          const rows = await npiQuery(params);
          return rows
            .map((row) => mapResult(row, preset))
            .filter((f): f is NpiFacility => f !== null);
        } catch (error) {
          console.error(
            `NPI query failed (${preset.label} / ${city}):`,
            error instanceof Error ? error.message : error,
          );
          return [];
        }
      }),
    );
    for (const facilities of results) {
      for (const facility of facilities) {
        if (!byNpi.has(facility.npi)) byNpi.set(facility.npi, facility);
      }
    }
  }

  const facilities = [...byNpi.values()].sort((a, b) =>
    (a.facilityType + a.organizationName).localeCompare(b.facilityType + b.organizationName),
  );

  return { facilities, queriesRun: toRun.length, queriesCapped: capped };
}

export function getFacilityPreset(key: string): FacilityTypePreset | undefined {
  return FACILITY_TYPE_PRESETS.find((p) => p.key === key);
}

/** Expands county selections into their city lists and merges any
 *  explicitly-provided cities. */
export function resolveCities(input: { counties?: string[]; cities?: string[] }): string[] {
  const cities = new Set<string>();
  for (const county of input.counties ?? []) {
    for (const city of FLORIDA_COUNTY_CITIES[county] ?? []) cities.add(city);
  }
  for (const city of input.cities ?? []) {
    const trimmed = city.trim();
    if (trimmed) cities.add(trimmed);
  }
  return [...cities];
}
