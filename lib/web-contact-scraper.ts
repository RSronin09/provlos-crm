// ---------------------------------------------------------------------------
// Website contact scraper — the free enrichment source.
//
// Many healthcare facilities publish leadership/staff contact info on their
// own sites (contact, team, about, leadership pages). Reading those pages is
// free, so it runs BEFORE any paid provider (Hunter, Apollo, PDL) in the
// enrichment cascade.
// ---------------------------------------------------------------------------

import { parseDomain } from "@/lib/text";

const PAGE_TIMEOUT_MS = 6_000;
const MAX_PAGES = 8;
const MAX_PAGE_BYTES = 600_000;
// Browser-like UA — plenty of facility sites 403 anything that looks like a
// bot. Large health systems with real bot protection will still block, which
// is fine: the scrape fails gracefully and the cascade moves to Hunter/Apollo.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\(\d{3}\)\s?|\d{3}[-.\s])\d{3}[-.\s]\d{4}/g;

// "jane [at] facility [dot] com", "jane (at) facility.com", "jane AT facility DOT com"
const OBFUSCATED_EMAIL_REGEX =
  /([A-Z0-9._%+-]+)\s*[([{]?\s*(?:at|@)\s*[)\]}]?\s*([A-Z0-9-]+(?:\s*[([{]?\s*(?:dot|\.)\s*[)\]}]?\s*[A-Z0-9-]+)+)/gi;

/** Decodes Cloudflare email protection: <a data-cfemail="hex"> is XOR-encoded
 *  with the first byte as key — fully reversible client side. */
function decodeCfEmail(hex: string): string | null {
  if (!/^[0-9a-f]{4,}$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  const key = bytes[0];
  const decoded = bytes.slice(1).map((b) => String.fromCharCode(b ^ key)).join("");
  return decoded.includes("@") ? decoded.toLowerCase() : null;
}

/** Resolves "jane [at] facility [dot] com"-style obfuscation into real addresses. */
function extractObfuscatedEmails(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(OBFUSCATED_EMAIL_REGEX)) {
    const local = match[1];
    const domainPart = match[2]
      .replace(/\s*[([{]?\s*(?:dot|\.)\s*[)\]}]?\s*/gi, ".")
      .replace(/\s+/g, "");
    const candidate = `${local}@${domainPart}`.toLowerCase();
    if (EMAIL_REGEX.test(candidate)) found.push(candidate);
    EMAIL_REGEX.lastIndex = 0;
  }
  return found;
}

/** Pulls plausible email addresses out of arbitrary text (search snippets,
 *  page content), filtering asset filenames and placeholder domains. */
export function extractEmailsFromText(text: string): string[] {
  // Decode numeric/named HTML entities that hide the @ and dots from naive bots.
  const decoded = text
    .replace(/&#0*64;|&commat;/gi, "@")
    .replace(/&#0*46;|&period;/gi, ".")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return n >= 32 && n < 127 ? String.fromCharCode(n) : " ";
    });

  const found = new Set<string>();
  const candidates = [
    ...[...decoded.matchAll(EMAIL_REGEX)].map((m) => m[0]),
    ...extractObfuscatedEmails(decoded),
    ...[...decoded.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)]
      .map((m) => decodeCfEmail(m[1]))
      .filter((e): e is string => e !== null),
  ];
  for (const raw of candidates) {
    const email = raw.toLowerCase().replace(/^mailto:/, "");
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(email)) continue;
    if (/@(example|sentry|wixpress|placeholder|domain|email|yourdomain)\./.test(email)) continue;
    found.add(email);
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// JSON-LD structured data — many healthcare sites embed schema.org
// Person/Organization objects with email and telephone that never appear in
// the rendered text.
// ---------------------------------------------------------------------------

type JsonLdContact = { name: string | null; email: string | null; phone: string | null; title: string | null };

function walkJsonLd(node: unknown, out: JsonLdContact[]): void {
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && /person|physician|contactpoint|organization|localbusiness|medical/i.test(t))) {
    const email = typeof obj.email === "string" ? obj.email.replace(/^mailto:/i, "").toLowerCase() : null;
    const phone = typeof obj.telephone === "string" ? obj.telephone : null;
    if (email || phone) {
      out.push({
        name: typeof obj.name === "string" ? obj.name : null,
        email,
        phone,
        title: typeof obj.jobTitle === "string" ? obj.jobTitle : null,
      });
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") walkJsonLd(value, out);
  }
}

/** Extracts schema.org contact entries from <script type="application/ld+json"> blocks. */
export function extractJsonLdContacts(html: string): JsonLdContact[] {
  const out: JsonLdContact[] = [];
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walkJsonLd(JSON.parse(match[1]), out);
    } catch {
      // malformed JSON-LD is common; skip the block
    }
  }
  return out;
}

// Local parts that are mailboxes, not people.
const GENERIC_LOCAL_PARTS =
  /^(info|contact|admin|office|hello|admissions|marketing|hr|jobs|careers|billing|frontdesk|reception|support|sales|inquiries|webmaster|noreply|no-reply|privacy|media|press|referrals?)$/i;

// Paths worth trying when the homepage doesn't link to them explicitly.
const FALLBACK_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/team",
  "/our-team",
  "/staff",
  "/leadership",
  "/administration",
  "/directory",
  "/providers",
  "/meet-the-team",
];

const CONTACT_LINK_PATTERN = /(contact|team|staff|leader|about|management|administration|our-people|meet|directory|providers)/i;

export type ScrapedSite = {
  baseUrl: string;
  domain: string | null;
  pagesFetched: number;
  /** All unique emails found, lowercased. */
  emails: string[];
  /** Emails whose local part looks like a person rather than a shared mailbox. */
  personalEmails: string[];
  /** Plain-text content of each fetched page, for proximity matching. */
  textBlocks: string[];
  /** Contacts declared in schema.org JSON-LD blocks (often invisible in page text). */
  structuredContacts: JsonLdContact[];
};

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

const extractEmails = extractEmailsFromText;

function isPersonalEmail(email: string): boolean {
  const local = email.split("@")[0];
  return !GENERIC_LOCAL_PARTS.test(local);
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("html")) return null;
    const body = await response.text();
    return body.slice(0, MAX_PAGE_BYTES);
  } catch {
    return null;
  }
}

function normalizeBaseUrl(website: string): string {
  const withScheme = website.startsWith("http") ? website : `https://${website}`;
  return withScheme.replace(/\/+$/, "");
}

function discoverContactLinks(homepageHtml: string, baseUrl: string): string[] {
  const links = new Set<string>();
  for (const match of homepageHtml.matchAll(/href=["']([^"'#?]+)["']/gi)) {
    const href = match[1];
    if (!CONTACT_LINK_PATTERN.test(href)) continue;
    if (/\.(pdf|jpg|png|zip|doc)/i.test(href)) continue;
    try {
      const absolute = new URL(href, `${baseUrl}/`).toString();
      // Stay on the same site.
      if (parseDomain(absolute) !== parseDomain(baseUrl)) continue;
      links.add(absolute.replace(/\/+$/, ""));
    } catch {
      // ignore malformed hrefs
    }
  }
  return [...links];
}

/**
 * Fetches a site's homepage plus its most likely contact/team/leadership
 * pages and extracts every email address and the page text for
 * name-proximity matching. Returns null when the site is unreachable.
 */
export async function scrapeSiteForContacts(website: string): Promise<ScrapedSite | null> {
  const baseUrl = normalizeBaseUrl(website);
  const domain = parseDomain(baseUrl);

  const homepage = await fetchPage(baseUrl);

  const candidateUrls = new Set<string>();
  if (homepage) {
    for (const link of discoverContactLinks(homepage, baseUrl)) candidateUrls.add(link);
  }
  if (candidateUrls.size < 3) {
    for (const path of FALLBACK_PATHS) candidateUrls.add(`${baseUrl}${path}`);
  }
  candidateUrls.delete(baseUrl);

  const toFetch = [...candidateUrls].slice(0, MAX_PAGES - (homepage ? 1 : 0));
  const pages = (await Promise.all(toFetch.map(fetchPage))).filter((p): p is string => p !== null);
  if (homepage) pages.unshift(homepage);

  if (!pages.length) return null;

  const emails = new Set<string>();
  const textBlocks: string[] = [];
  const structuredContacts: JsonLdContact[] = [];
  for (const html of pages) {
    for (const email of extractEmails(html)) emails.add(email);
    for (const contact of extractJsonLdContacts(html)) {
      structuredContacts.push(contact);
      if (contact.email) emails.add(contact.email);
    }
    textBlocks.push(htmlToText(html));
  }

  const allEmails = [...emails];
  return {
    baseUrl,
    domain,
    pagesFetched: pages.length,
    emails: allEmails,
    personalEmails: allEmails.filter(isPersonalEmail),
    textBlocks,
    structuredContacts,
  };
}

function normalizeNamePart(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

/** Local-part shapes people actually use: jane.doe, jdoe, janed, jane_doe, janedoe, doej, doe.jane */
function localPartCandidates(first: string, last: string): string[] {
  if (!first || !last) return [];
  return [
    `${first}.${last}`,
    `${first[0]}${last}`,
    `${first}${last[0]}`,
    `${first}_${last}`,
    `${first}${last}`,
    `${last}${first[0]}`,
    `${last}.${first}`,
  ];
}

/** True when an email's local part is a recognizable form of the person's
 *  name (jane.doe@, jdoe@, janedoe@, ...). */
export function emailLocalPartMatchesName(
  email: string,
  firstName: string | null,
  lastName: string | null,
): boolean {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);
  if (!first || !last) return false;
  const local = email.toLowerCase().split("@")[0].replace(/[^a-z0-9._-]/g, "");
  return new Set(localPartCandidates(first, last)).has(local);
}

/** Candidate addresses for guess-and-verify, most common shapes first. */
export function emailPatternCandidates(
  firstName: string | null,
  lastName: string | null,
  domain: string,
): string[] {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);
  if (!first || !last) return [];
  return [
    `${first}.${last}@${domain}`,
    `${first[0]}${last}@${domain}`,
    `${first}@${domain}`,
    `${first}${last}@${domain}`,
    `${first}${last[0]}@${domain}`,
  ];
}

export type PersonContactHit = {
  email: string | null;
  phone: string | null;
  matchType: "structured_data" | "email_local_part" | "name_proximity" | null;
};

/**
 * Looks for a specific person's email/phone in scraped site content:
 * first by matching email local parts against their name (jane.doe@, jdoe@),
 * then by finding contact info within ±300 chars of their name in page text.
 */
export function findPersonContact(
  site: ScrapedSite,
  firstName: string | null,
  lastName: string | null,
): PersonContactHit {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);

  // JSON-LD is the most reliable hit: the site itself declares the person.
  if (first && last) {
    for (const contact of site.structuredContacts) {
      const name = normalizeNamePart(contact.name);
      if (!name || !name.includes(last) || !name.includes(first)) continue;
      if (contact.email || contact.phone) {
        return { email: contact.email, phone: contact.phone, matchType: "structured_data" };
      }
    }
  }

  let localPartEmail: string | null = null;
  if (first && last) {
    const candidates = new Set(localPartCandidates(first, last));
    for (const email of site.personalEmails) {
      const local = email.split("@")[0].replace(/[^a-z0-9._-]/g, "");
      if (candidates.has(local)) {
        localPartEmail = email;
        break;
      }
    }
  }

  // Proximity: name appears in page text with contact info nearby. Runs even
  // after a local-part hit, because the phone usually sits next to the name.
  if (firstName && lastName) {
    const namePattern = new RegExp(
      `${firstName.replace(/[^a-zA-Z'-]/g, "")}\\s+${lastName.replace(/[^a-zA-Z'-]/g, "")}`,
      "i",
    );
    for (const text of site.textBlocks) {
      const match = namePattern.exec(text);
      if (!match) continue;
      // Look only AFTER the name: staff listings put each person's contact
      // info after their name, and a symmetric window would pick up the
      // previous person's email/phone on tightly-packed team pages.
      const window = text.slice(match.index, match.index + 250);
      const email = window.match(EMAIL_REGEX)?.[0]?.toLowerCase() ?? null;
      const phone = window.match(PHONE_REGEX)?.[0] ?? null;
      if (email || phone) {
        return {
          email: localPartEmail ?? email,
          phone,
          matchType: localPartEmail ? "email_local_part" : "name_proximity",
        };
      }
    }
  }

  if (localPartEmail) {
    return { email: localPartEmail, phone: null, matchType: "email_local_part" };
  }
  return { email: null, phone: null, matchType: null };
}

/**
 * Last-resort guess: if the site publishes other employees' emails in a
 * clear first.last@domain shape, apply the same pattern to the target name.
 * Only guesses when the scraped emails are on the account's own domain, and
 * only when the domain actually accepts mail (MX check).
 */
export async function inferEmailFromSitePattern(
  site: ScrapedSite,
  firstName: string | null,
  lastName: string | null,
): Promise<string | null> {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);
  if (!first || !last || !site.domain) return null;

  const firstDotLast = site.personalEmails.some(
    (email) => email.endsWith(`@${site.domain}`) && /^[a-z]{2,}\.[a-z]{2,}@/.test(email),
  );
  if (!firstDotLast) return null;

  if (!(await domainAcceptsMail(site.domain))) return null;
  return `${first}.${last}@${site.domain}`;
}

/** Free MX lookup via DNS-over-HTTPS — filters out domains that can't receive mail. */
export async function domainAcceptsMail(domain: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) return true; // don't block enrichment on DNS API hiccups
    const payload = (await response.json()) as { Answer?: unknown[] };
    return Array.isArray(payload.Answer) && payload.Answer.length > 0;
  } catch {
    return true;
  }
}
