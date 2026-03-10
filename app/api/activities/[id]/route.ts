import { unauthorizedResponse, uuidSchema, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { activityUpdateSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid activity id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = activityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const activity = await db.activity.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ data: activity });
}
