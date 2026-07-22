// ---------------------------------------------------------------------------
// Territory — the hard geofence for the facility universe.
//
// The lead universe is defined as licensed post-acute facilities in
// Sarasota + Manatee counties, FL. Every ingestion path (registry import,
// Instantly import, spreadsheet intake) checks against this before creating
// an account: out-of-territory rows are flagged or skipped, never silently
// imported. This is the guard against the audit's failure mode where
// national chains and wrong-market facilities entered the CRM wholesale.
//
// Dependency-free of server code so client components can import it.
// ---------------------------------------------------------------------------

import { FLORIDA_COUNTY_CITIES } from "@/lib/instantly-constants";

/** Counties that constitute the geofenced universe. Lee County exists in
 *  FLORIDA_COUNTY_CITIES for optional searching but is NOT part of the
 *  territory. */
export const TARGET_COUNTIES = ["Sarasota County, FL", "Manatee County, FL"] as const;

const TARGET_CITY_SET = new Set(
  TARGET_COUNTIES.flatMap((county) =>
    (FLORIDA_COUNTY_CITIES[county] ?? []).map((city) => city.toLowerCase()),
  ),
);

function normalizeState(state: string | null | undefined): string {
  return (state ?? "").trim().toUpperCase();
}

/**
 * True when a location is inside the target territory.
 * A missing city is treated as UNKNOWN (returns null) rather than in/out —
 * callers decide whether unknown rows are flagged for review or allowed.
 */
export function isInTargetTerritory(
  city: string | null | undefined,
  state: string | null | undefined,
): boolean | null {
  const st = normalizeState(state);
  if (st && st !== "FL" && st !== "FLORIDA") return false;
  const cityNorm = (city ?? "").trim().toLowerCase();
  if (!cityNorm) return st ? null : null;
  return TARGET_CITY_SET.has(cityNorm);
}

/** County label for an in-territory city, else null. */
export function countyForCity(city: string | null | undefined): string | null {
  const cityNorm = (city ?? "").trim().toLowerCase();
  if (!cityNorm) return null;
  for (const county of TARGET_COUNTIES) {
    if ((FLORIDA_COUNTY_CITIES[county] ?? []).some((c) => c.toLowerCase() === cityNorm)) {
      return county;
    }
  }
  return null;
}
