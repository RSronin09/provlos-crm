import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse, uuidSchema } from "@/lib/api";
import { deliveryUpdateSchema } from "@/lib/crm-validation";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const delivery = await db.delivery.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, companyName: true } },
      assignedDriver: { select: { id: true, name: true, phone: true } },
      statusHistory: { orderBy: { changedAt: "desc" } },
    },
  });

  if (!delivery) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: delivery });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = deliveryUpdateSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const delivery = await db.delivery.update({
    where: { id },
    data: parsed.data,
    include: {
      customer: { select: { id: true, companyName: true } },
      assignedDriver: { select: { id: true, name: true, phone: true } },
    },
  });

  return Response.json({ data: delivery });
}
