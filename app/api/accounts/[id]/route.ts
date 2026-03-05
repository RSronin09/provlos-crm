import { unauthorizedResponse, uuidSchema, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { accountUpdateSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const idResult = uuidSchema.safeParse(id);

  if (!idResult.success) {
    return Response.json({ error: "Invalid account id" }, { status: 400 });
  }

  const account = await db.account.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          contacts: true,
          activities: true,
          tasks: true,
          enrichmentJobs: true,
        },
      },
    },
  });

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  return Response.json({ data: account });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const idResult = uuidSchema.safeParse(id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid account id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = accountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { sourceRowJson, ...rest } = parsed.data;
  const data: Prisma.AccountUpdateInput = { ...rest };
  if (sourceRowJson !== undefined) {
    data.sourceRowJson = sourceRowJson === null ? Prisma.JsonNull : sourceRowJson;
  }

  const account = await db.account.update({
    where: { id },
    data,
  });

  return Response.json({ data: account });
}
