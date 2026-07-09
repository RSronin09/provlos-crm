export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SOCIAL_HOSTS = /linkedin|facebook|twitter/;

/**
 * Extracts a bare hostname (without `www.`) from a URL or bare-domain string.
 * Returns null when the value can't be parsed, or when `excludeSocial` is set
 * and the host is a social network rather than a company website.
 */
export function parseDomain(
  value: string | null | undefined,
  options: { excludeSocial?: boolean } = {},
): string | null {
  if (!value) return null;
  try {
    const url = value.startsWith("http") ? value : `https://${value}`;
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (options.excludeSocial && SOCIAL_HOSTS.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}
