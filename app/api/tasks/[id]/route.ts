import { unauthorizedResponse, uuidSchema, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { taskUpdateSchema } from "@/lib/crm-validation";
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
    return Response.json({ error: "Invalid task id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const task = await db.task.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ data: task });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const idResult = uuidSchema.safeParse(id);
  if (!idResult.success) {
    return Response.json({ error: "Invalid task id" }, { status: 400 });
  }

  await db.task.delete({
    where: { id },
  });

  return Response.json({ ok: true });
}
