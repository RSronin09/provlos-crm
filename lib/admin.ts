import { NextRequest } from "next/server";

export function isAdminRequest(request: NextRequest): boolean {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured) {
    return false;
  }

  const token = request.headers.get("x-admin-token");
  return token === configured;
}
