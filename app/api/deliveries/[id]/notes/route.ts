import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse, uuidSchema } from "@/lib/api";
import { deliveryNotesSchema } from "@/lib/crm-validation";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = deliveryNotesSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const delivery = await db.delivery.update({
    where: { id },
    data: { dispatcherNotes: parsed.data.dispatcherNotes },
  });

  return Response.json({ data: delivery });
}
