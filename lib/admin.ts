import { NextRequest } from "next/server";

export const ADMIN_TOKEN_COOKIE = "crm_admin_token";

/**
 * Authorizes write requests.
 *
 * - When ADMIN_TOKEN is not configured, writes are open (private/internal use).
 * - When ADMIN_TOKEN is set, the request must present the matching token via
 *   the `x-admin-token` header or the `crm_admin_token` cookie (set by the
 *   admin-token field in the UI, see lib/use-admin-token.ts).
 */
export function isAdminRequest(request: NextRequest): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return true;

  const headerToken = request.headers.get("x-admin-token");
  if (headerToken === adminToken) return true;

  const cookieToken = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
  if (!cookieToken) return false;
  try {
    return decodeURIComponent(cookieToken) === adminToken;
  } catch {
    return false;
  }
}
