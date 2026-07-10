import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { registrySearchSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { resolveCities, searchNpiFacilities } from "@/lib/npi";
import { NextRequest } from "next/server";

// Free — queries the public NPPES NPI registry (no API key required) and
// returns licensed healthcare facilities with their authorized official
// (name, title, phone). Flags facilities already present in the CRM.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const parsed = registrySearchSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const cities = resolveCities(parsed.data);
  if (!cities.length) {
    return Response.json(
      { error: "Select at least one county or provide a city list." },
      { status: 400 },
    );
  }

  const { facilities, queriesRun, queriesCapped } = await searchNpiFacilities({
    cities,
    state: parsed.data.state,
    facilityTypeKeys: parsed.data.facilityTypes,
  });

  // Flag facilities that already exist in the CRM (matched by name).
  const names = facilities.map((f) => f.organizationName);
  const existing = names.length
    ? await db.account.findMany({
        where: { companyName: { in: names, mode: "insensitive" } },
        select: { id: true, companyName: true },
      })
    : [];
  const existingByName = new Map(existing.map((a) => [a.companyName.toLowerCase(), a.id]));

  return Response.json({
    data: {
      facilities: facilities.map((f) => ({
        ...f,
        existingAccountId: existingByName.get(f.organizationName.toLowerCase()) ?? null,
      })),
      totalFound: facilities.length,
      alreadyInCrm: facilities.filter((f) =>
        existingByName.has(f.organizationName.toLowerCase()),
      ).length,
      queriesRun,
      queriesCapped,
    },
  });
}
