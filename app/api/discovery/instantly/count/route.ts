import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { instantlyCountSchema } from "@/lib/crm-validation";
import { countLeadsFromSuperSearch, resolveSearchFilters } from "@/lib/instantly";
import { NextRequest } from "next/server";

// Free to call — no Instantly credits are spent on a count check.
// Use this to sanity-check a search before running the (paid) enrich step.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const parsed = instantlyCountSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const filters = resolveSearchFilters(parsed.data);
  const result = await countLeadsFromSuperSearch(filters);

  if (!result.ok) {
    return Response.json({ error: result.error ?? "Instantly count request failed" }, { status: 502 });
  }

  return Response.json({ data: { count: result.count, filters } });
}
