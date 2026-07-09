// Pure constants shared between the server-side Instantly client (lib/instantly.ts)
// and client components (e.g. components/crm/instantly-search-panel.tsx).
// Kept dependency-free (no `process.env`, no `fetch`) so it's safe to import
// from "use client" components without pulling server-only code into the bundle.

export const INSTANTLY_INDUSTRIES = [
  "Agriculture & Mining",
  "Business Services",
  "Computers & Electronics",
  "Consumer Services",
  "Education",
  "Energy & Utilities",
  "Financial Services",
  "Government",
  "Healthcare, Pharmaceuticals, & Biotech",
  "Manufacturing",
  "Media & Entertainment",
  "Non-Profit",
  "Other",
  "Real Estate & Construction",
  "Retail",
  "Software & Internet",
  "Telecommunications",
  "Transportation & Storage",
  "Travel, Recreation, and Leisure",
  "Wholesale & Distribution",
] as const;

export type InstantlyIndustry = (typeof INSTANTLY_INDUSTRIES)[number];

// Sub-industries relevant to healthcare/elder-care facility searches.
// (The full Instantly enum has ~150 values across every industry — we only
// enumerate the ones this CRM's client base cares about; pass raw strings
// for anything else, the field accepts free-form enum values.)
export const INSTANTLY_HEALTHCARE_SUB_INDUSTRIES = [
  "Hospital & Health Care",
  "Medical Practice",
  "Mental Health Care",
  "Alternative Medicine",
  "Individual & Family Services",
  "Health, Wellness and Fitness",
] as const;

export const INSTANTLY_EMPLOYEE_COUNT_BRACKETS = [
  "0 - 25",
  "25 - 100",
  "100 - 250",
  "250 - 1000",
  "1K - 10K",
  "10K - 50K",
  "50K - 100K",
  "> 100K",
] as const;

export type InstantlyEmployeeCountBracket = (typeof INSTANTLY_EMPLOYEE_COUNT_BRACKETS)[number];

export const INSTANTLY_LEVELS = [
  "C-Level",
  "VP-Level",
  "Director-Level",
  "Manager-Level",
  "Owner",
  "Executive",
  "Senior",
] as const;

export type InstantlyLevel = (typeof INSTANTLY_LEVELS)[number];

/** Cities within each Florida county we've been asked to target. SuperSearch's
 *  location filter doesn't support counties directly, so we expand a county
 *  into its constituent cities. Add more counties/cities here as needed — no
 *  Google Places API key required for this form of the filter.
 *
 *  For tighter precision later, a `place_id` (Google Maps Place ID for the
 *  county itself, e.g. from https://developers.google.com/maps/documentation/places/web-service/place-id)
 *  can be used instead of city/state — see `InstantlyLocation` in lib/instantly.ts. */
export const FLORIDA_COUNTY_CITIES: Record<string, string[]> = {
  "Lee County, FL": ["Fort Myers", "Cape Coral", "Bonita Springs", "Estero", "Lehigh Acres", "Sanibel"],
  "Sarasota County, FL": ["Sarasota", "Venice", "North Port", "Englewood", "Osprey", "Nokomis"],
};

/** Job titles worth targeting at healthcare/senior-living facilities —
 *  mirrors the healthcare title list already used for Apollo in
 *  lib/decision-makers.ts, kept separate here since Instantly's `title`
 *  filter takes free-text values rather than Apollo's exact enum. */
export const HEALTHCARE_FACILITY_TITLES = [
  "Administrator",
  "Executive Director",
  "Director of Nursing",
  "Director of Operations",
  "Facility Administrator",
  "Director of Admissions",
  "Director of Materials Management",
  "Purchasing Director",
  "Director of Support Services",
];

/** Suggested keyword phrases for the optional keyword filter. Instantly's
 *  keyword_filter takes ONE literal include string (no OR syntax) that is
 *  ANDed with every other filter, so use at most one of these per search —
 *  never a joined list. */
export const HEALTHCARE_FACILITY_KEYWORDS = [
  "nursing home",
  "skilled nursing",
  "assisted living",
  "memory care",
  "active adult living",
  "adult day care",
  "elderly day care",
  "dialysis",
  "home health",
  "hospice",
];
