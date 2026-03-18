import { db } from "@/lib/db";
import { zodErrorResponse, uuidSchema } from "@/lib/api";
import { deliveryStatusUpdateSchema } from "@/lib/crm-validation";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = deliveryStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const existing = await db.delivery.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const delivery = await db.$transaction(async (tx) => {
    const updated = await tx.delivery.update({
      where: { id },
      data: { status: parsed.data.status },
      include: {
        assignedDriver: { select: { id: true, name: true } },
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: id,
        oldStatus: existing.status,
        newStatus: parsed.data.status,
        changedBy: parsed.data.changedBy,
        note: parsed.data.note ?? null,
      },
    });

    return updated;
  });

  return Response.json({ data: delivery });
}
