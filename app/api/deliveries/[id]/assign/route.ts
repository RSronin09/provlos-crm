import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse, uuidSchema } from "@/lib/api";
import { deliveryAssignSchema } from "@/lib/crm-validation";
import { DeliveryStatus } from "@prisma/client";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = deliveryAssignSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const existing = await db.delivery.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const newStatus: DeliveryStatus =
    parsed.data.driverId === null
      ? DeliveryStatus.pending
      : existing.status === DeliveryStatus.pending
      ? DeliveryStatus.assigned
      : existing.status;

  const delivery = await db.$transaction(async (tx) => {
    const updated = await tx.delivery.update({
      where: { id },
      data: {
        assignedDriverId: parsed.data.driverId,
        status: newStatus,
        ...(parsed.data.driverId && newStatus === DeliveryStatus.assigned
          ? { assignedAt: new Date() }
          : {}),
      },
      include: {
        assignedDriver: { select: { id: true, name: true } },
      },
    });

    if (existing.status !== newStatus) {
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: id,
          oldStatus: existing.status,
          newStatus,
          changedBy: parsed.data.changedBy,
          note: parsed.data.driverId
            ? `Driver assigned`
            : `Driver unassigned`,
        },
      });
    }

    return updated;
  });

  return Response.json({ data: delivery });
}
