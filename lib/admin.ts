import { NextRequest } from "next/server";

export function isAdminRequest(request: NextRequest): boolean {
  const configured = process.env.ADMIN_TOKEN?.trim();
  if (!configured) {
    return false;
  }

  const token = request.headers.get("x-admin-token")?.trim();
  if (token && token === configured) {
    return true;
  }

  // Optional fallback for API clients using Authorization header.
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const bearer = authorization.slice(7).trim();
    return bearer === configured;
  }

  return false;
}
