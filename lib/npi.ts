// ---------------------------------------------------------------------------
// NPPES NPI Registry — the U.S. government's registry of every healthcare
// organization (CMS). Free, no API key, no rate-limit headaches, and it
// includes an "authorized official" (name + title + phone) for every
// facility — i.e. a decision-maker contact straight from the source.
//
// This is the primary lead source for the NEMT (non-emergency medical
// transportation) ICP: the facilities whose patients and residents need
// recurring rides — dialysis clinics, nursing homes, assisted living,
// hospitals (discharges), rehab, adult day care. Instead of scraping search
// results or paying per-contact for third-party B2B data (which is thin for
// small facilities), we enumerate the actual licensed facility universe in
// the target geography, then spend paid enrichment credits only on finding
// email addresses.
//
// Docs: https://npiregistry.cms.hhs.gov/api-page
// ---------------------------------------------------------------------------

import { FLORIDA_COUNTY_CITIES } from "@/lib/instantly-constants";

const NPI_API_BASE = "https://npiregistry.cms.hhs.gov/api/";

/** How facility types map to NPI taxonomy searches, plus NEMT-sales context
 *  that gets written onto imported accounts.
 *
 *  Note: `whatTheyMove` / `whyHireCouriers` are the Account schema column
 *  names (displayed in the UI as "Who They Transport" / "Why They Need
 *  NEMT" — see lib/account-types.ts). */
export type FacilityTypePreset = {
  key: string;
  label: string;
  /** Passed to the API's taxonomy_description param (partial match). */
  taxonomyQuery: string;
  /** Drop results whose primary taxonomy matches (partial-match noise). */
  excludeTaxonomyPattern?: RegExp;
  whatTheyMove: string;
  whyHireCouriers: string;
  /** Selected by default in the UI. */
  defaultSelected: boolean;
};

export const FACILITY_TYPE_PRESETS: FacilityTypePreset[] = [
  {
    key: "dialysis",
    label: "Dialysis Center (ESRD)",
    taxonomyQuery: "End-Stage Renal Disease",
    whatTheyMove: "Patients to and from dialysis treatment, typically 3x per week on fixed schedules",
    whyHireCouriers:
      "Highest-volume recurring NEMT demand — patients can't drive post-treatment and clinics coordinate standing ride schedules",
    defaultSelected: true,
  },
  {
    key: "snf",
    label: "Skilled Nursing Facility",
    taxonomyQuery: "Skilled Nursing Facility",
    whatTheyMove: "Residents to specialist appointments, dialysis, imaging, and hospital discharges back to the facility",
    whyHireCouriers:
      "Wheelchair and stretcher transport for residents; facilities rarely run their own accessible vehicles",
    defaultSelected: true,
  },
  {
    key: "alf",
    label: "Assisted Living Facility",
    taxonomyQuery: "Assisted Living Facility",
    whatTheyMove: "Residents to medical appointments, therapy, and dialysis",
    whyHireCouriers:
      "Residents no longer drive; families expect the facility to arrange safe door-through-door transport",
    defaultSelected: true,
  },
  {
    key: "hospital",
    label: "Hospital",
    taxonomyQuery: "General Acute Care Hospital",
    whatTheyMove: "Discharged patients home or to post-acute facilities; inter-facility transfers",
    whyHireCouriers:
      "Case managers and discharge planners need same-day wheelchair/stretcher transport to free up beds",
    defaultSelected: true,
  },
  {
    key: "rehab",
    label: "Rehabilitation (Inpatient & Outpatient)",
    taxonomyQuery: "Rehabilitation",
    excludeTaxonomyPattern: /chiropractor|rehabilitation practitioner|substance/i,
    whatTheyMove: "Patients to recurring outpatient therapy sessions and discharges after inpatient stays",
    whyHireCouriers: "Multi-week therapy schedules create standing round-trip ride needs",
    defaultSelected: true,
  },
  {
    key: "adult_day",
    label: "Adult Day Care",
    taxonomyQuery: "Adult Day Care",
    whatTheyMove: "Participants between home and the center every program day",
    whyHireCouriers: "Daily round-trip transport is core to their operating model; many outsource it",
    defaultSelected: true,
  },
  {
    key: "oncology",
    label: "Oncology Clinic",
    taxonomyQuery: "Oncology",
    whatTheyMove: "Patients to daily radiation and recurring chemotherapy/infusion appointments",
    whyHireCouriers: "Radiation runs 5 days/week for weeks at a time; patients are often too ill to drive",
    defaultSelected: false,
  },
  {
    key: "pt",
    label: "Physical Therapy Clinic",
    taxonomyQuery: "Physical Therapy",
    whatTheyMove: "Patients (often elderly or post-surgery) to recurring therapy visits",
    whyHireCouriers: "Missed rides mean missed billable visits — clinics have direct incentive to arrange transport",
    defaultSelected: false,
  },
  {
    key: "home_health",
    label: "Home Health Agency",
    taxonomyQuery: "Home Health",
    whatTheyMove: "Home-bound patients to physician follow-ups, wound care, and imaging appointments",
    whyHireCouriers: "Care teams coordinate appointments for patients who have no transportation of their own",
    defaultSelected: false,
  },
  {
    key: "hospice",
    label: "Hospice",
    taxonomyQuery: "Hospice",
    whatTheyMove: "Patients between home, inpatient hospice units, and facilities",
    whyHireCouriers: "Stretcher and wheelchair moves that don't require an ambulance",
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

  if (primaryTaxonomy && preset.excludeTaxonomyPattern?.test(primaryTaxonomy)) return null;

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
// 10 facility types × up to 12 target cities fits inside the cap.
const MAX_QUERIES_PER_SEARCH = 120;
const CONCURRENCY = 8;

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
