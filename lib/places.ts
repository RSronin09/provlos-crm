// ---------------------------------------------------------------------------
// Serper Maps — Google Business Profile lookup via the existing Serper key.
//
// Healthcare facilities always have a Google Business listing with a working
// front-desk phone. That main line is the guaranteed fallback channel: even
// when no direct email/phone exists for a decision-maker, the contact is
// reachable via "call the facility, ask for <name, title>".
//
// Uses the /maps endpoint (NOT /places) — only /maps returns phoneNumber
// and website for each listing.
// ---------------------------------------------------------------------------

import { parseDomain } from "@/lib/text";

export type PlaceResult = {
  phone: string | null;
  website: string | null;
  address: string | null;
};

type SerperMapsPlace = {
  title?: string;
  phoneNumber?: string;
  website?: string;
  address?: string;
};

const MATCH_STOPWORDS = new Set([
  "the", "at", "of", "and", "a", "an", "in", "for",
  "inc", "llc", "corp", "co", "group", "center", "centre",
]);

function significantTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // "(Bradenton)" is a location hint, not part of the business name
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !MATCH_STOPWORDS.has(token));
}

/** True when the listing plausibly IS the company: same website domain, or
 *  most of the company name's significant tokens appear in the listing title. */
function placeMatchesCompany(
  place: SerperMapsPlace,
  companyName: string,
  companyDomain: string | null,
): boolean {
  const placeDomain = parseDomain(place.website ?? null);
  if (companyDomain && placeDomain && companyDomain === placeDomain) return true;

  const companyTokens = significantTokens(companyName);
  if (!companyTokens.length) return false;
  const titleTokens = new Set(significantTokens(place.title ?? ""));
  const overlap = companyTokens.filter((token) => titleTokens.has(token)).length;
  return overlap >= Math.min(2, companyTokens.length) && overlap / companyTokens.length >= 0.5;
}

/**
 * Looks up a facility's Google Business listing and returns its phone,
 * website, and address. A result is only accepted when it verifiably matches
 * the company (shared website domain, or strong name overlap), so a generic
 * query can't attach the wrong facility's phone.
 */
export async function lookupPlace(
  companyName: string,
  context?: { city?: string | null; state?: string | null; domain?: string | null },
): Promise<PlaceResult | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  const query = [companyName.replace(/[()]/g, " "), context?.city, context?.state]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  try {
    const response = await fetch("https://google.serper.dev/maps", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ q: query }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { places?: SerperMapsPlace[] };
    const match = (payload.places ?? []).find(
      (place) =>
        (place.phoneNumber || place.website) &&
        placeMatchesCompany(place, companyName, context?.domain ?? null),
    );
    if (!match) return null;

    return {
      phone: match.phoneNumber ?? null,
      website: match.website ?? null,
      address: match.address ?? null,
    };
  } catch {
    return null;
  }
}
