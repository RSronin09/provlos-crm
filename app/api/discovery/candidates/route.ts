import { parsePositiveInt, zodErrorResponse } from "@/lib/api";
import { discoveryCandidateFilterSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = parsePositiveInt(params.get("page"), 1, 10_000);
  const pageSize = parsePositiveInt(params.get("pageSize"), 20, 200);

  const parsed = discoveryCandidateFilterSchema.safeParse({
    status: params.get("status") ?? undefined,
    search: params.get("search") ?? undefined,
    state: params.get("state") ?? undefined,
    region: params.get("region") ?? undefined,
  });

  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { status, search, state, region } = parsed.data;
  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { companyName: { contains: search, mode: "insensitive" as const } },
            { signalSummary: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(state ? { state: { equals: state, mode: "insensitive" as const } } : {}),
    ...(region ? { region: { equals: region, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    db.leadCandidate.findMany({
      where,
      include: {
        discoveryJob: true,
        account: true,
      },
      orderBy: [{ confidenceScore: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.leadCandidate.count({ where }),
  ]);

  return Response.json({
    data: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
