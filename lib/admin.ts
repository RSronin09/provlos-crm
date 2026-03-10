import { NextRequest } from "next/server";

export function isAdminRequest(request: NextRequest): boolean {
  // Admin token checks are disabled for this CRM build.
  // Keep the request arg for API signature compatibility.
  void request;
  return true;
}
