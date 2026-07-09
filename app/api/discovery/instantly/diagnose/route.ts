import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { instantlyCountSchema } from "@/lib/crm-validation";
import { diagnoseSearchFilters, resolveSearchFilters } from "@/lib/instantly";
import { NextRequest } from "next/server";

// Free to call — re-runs the lead count with progressively fewer filters to
// pinpoint which filter is producing a zero-match search.
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
  const steps = await diagnoseSearchFilters(filters);

  return Response.json({ data: { steps, filters } });
}
