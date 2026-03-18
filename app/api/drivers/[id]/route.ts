import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse, uuidSchema } from "@/lib/api";
import { driverUpdateSchema } from "@/lib/crm-validation";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const driver = await db.driver.findUnique({
    where: { id },
    include: {
      deliveries: {
        where: { status: { notIn: ["delivered", "cancelled"] } },
        orderBy: [{ priorityLevel: "desc" }, { requestedDeliveryDateTime: "asc" }],
        include: { customer: { select: { id: true, companyName: true } } },
      },
    },
  });

  if (!driver) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: driver });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = driverUpdateSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const driver = await db.driver.update({ where: { id }, data: parsed.data });
  return Response.json({ data: driver });
}
