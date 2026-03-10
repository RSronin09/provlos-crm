import { parsePositiveInt, unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { accountCreateSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { AccountStage, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

const accountFilterSchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  stage: z.nativeEnum(AccountStage).optional(),
  state: z.string().optional(),
  region: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = parsePositiveInt(params.get("page"), 1, 10_000);
  const pageSize = parsePositiveInt(params.get("pageSize"), 20, 200);

  const parsed = accountFilterSchema.safeParse({
    search: params.get("search") ?? undefined,
    industry: params.get("industry") ?? undefined,
    stage: params.get("stage") ?? undefined,
    state: params.get("state") ?? undefined,
    region: params.get("region") ?? undefined,
  });

  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { search, stage, state, industry, region } = parsed.data;
  const where = {
    ...(search
      ? {
          OR: [
            { companyName: { contains: search, mode: "insensitive" as const } },
            { website: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(industry ? { industry: { equals: industry, mode: "insensitive" as const } } : {}),
    ...(stage ? { stage } : {}),
    ...(state ? { state: { equals: state, mode: "insensitive" as const } } : {}),
    ...(region ? { region: { equals: region, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    db.account.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.account.count({ where }),
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

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = accountCreateSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { sourceRowJson, ...rest } = parsed.data;
  const data: Prisma.AccountCreateInput = { ...rest };
  if (sourceRowJson !== undefined) {
    data.sourceRowJson = sourceRowJson === null ? Prisma.JsonNull : sourceRowJson;
  }

  const created = await db.account.create({
    data,
  });

  return Response.json({ data: created }, { status: 201 });
}
