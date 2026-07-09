import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { instantlyCountSchema } from "@/lib/crm-validation";
import { previewLeadsFromSuperSearch, resolveSearchFilters } from "@/lib/instantly";
import { NextRequest } from "next/server";

// Free to call — returns a sample of matching leads (name, title, company,
// LinkedIn; no email/phone) so filters can be sanity-checked before spending
// credits on the enrich step.
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
  const result = await previewLeadsFromSuperSearch(filters);

  if (!result.ok) {
    // Echo the filters so failures can be debugged against Instantly's docs.
    return Response.json(
      { error: result.error ?? "Instantly preview request failed", filters },
      { status: 502 },
    );
  }

  return Response.json({
    data: {
      totalCount: result.totalCount,
      leads: result.leads,
      filters,
    },
  });
}
