import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { instantlySearchSchema } from "@/lib/crm-validation";
import { enrichLeadsFromSuperSearch, resolveSearchFilters } from "@/lib/instantly";
import { NextRequest } from "next/server";

// Costs Instantly credits. Kicks off a background job on Instantly's side
// that finds matching leads and lands them (with verified email) in a list.
// The job is not instant — poll GET /api/discovery/instantly/search?resourceId=...
// or wait a few minutes, then call POST /api/discovery/instantly/import to
// pull the results into this CRM.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const parsed = instantlySearchSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const filters = resolveSearchFilters(parsed.data);
  const result = await enrichLeadsFromSuperSearch({
    filters,
    limit: parsed.data.limit,
    listName: parsed.data.listName ?? `CRM Discovery — ${new Date().toISOString().slice(0, 10)}`,
    resourceId: parsed.data.resourceId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error ?? "Instantly enrichment request failed" }, { status: 502 });
  }

  return Response.json({
    data: {
      resourceId: result.resourceId,
      backgroundJobId: result.backgroundJobId,
      listName: result.listName,
      filters,
    },
    message:
      "Enrichment started in Instantly. This runs in the background and can take a few minutes — " +
      "once it's done, call /api/discovery/instantly/import with this resourceId to pull the leads into the CRM.",
  });
}
