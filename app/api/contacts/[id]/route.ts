import { unauthorizedResponse, uuidSchema, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { contactUpdateSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const idResult = uuidSchema.safeParse(id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid contact id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = contactUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const contact = await db.contact.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ data: contact });
}
