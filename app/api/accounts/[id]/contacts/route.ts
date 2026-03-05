import { unauthorizedResponse, uuidSchema, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { contactCreateSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const idResult = uuidSchema.safeParse(id);

  if (!idResult.success) {
    return Response.json({ error: "Invalid account id" }, { status: 400 });
  }

  const contacts = await db.contact.findMany({
    where: { accountId: id },
    orderBy: [{ isDoNotContact: "asc" }, { lastName: "asc" }],
  });

  return Response.json({ data: contacts });
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const idResult = uuidSchema.safeParse(id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid account id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = contactCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const created = await db.contact.create({
    data: {
      ...parsed.data,
      accountId: id,
    },
  });

  return Response.json({ data: created }, { status: 201 });
}
