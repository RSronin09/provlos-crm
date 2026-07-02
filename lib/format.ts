/** Ensures a user-entered URL has a scheme so it renders as an absolute link instead of a relative one. */
export function withHttpProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
