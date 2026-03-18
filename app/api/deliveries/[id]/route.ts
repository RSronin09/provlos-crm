import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse, uuidSchema } from "@/lib/api";
import { deliveryUpdateSchema } from "@/lib/crm-validation";
import { geocodeDeliveryAddresses } from "@/lib/geocoding";
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

  // Re-geocode only if addresses changed
  let geoUpdate: Record<string, number | null> = {};
  if (parsed.data.pickupAddress || parsed.data.deliveryAddress) {
    const existing = await db.delivery.findUnique({
      where: { id },
      select: { pickupAddress: true, deliveryAddress: true },
    });
    if (existing) {
      const pickup = parsed.data.pickupAddress ?? existing.pickupAddress;
      const delivery_ = parsed.data.deliveryAddress ?? existing.deliveryAddress;
      const geo = await geocodeDeliveryAddresses(pickup, delivery_).catch(
        () => ({ pickupLat: null, pickupLng: null, deliveryLat: null, deliveryLng: null }),
      );
      geoUpdate = geo;
    }
  }

  const delivery = await db.delivery.update({
    where: { id },
    data: { ...parsed.data, ...geoUpdate },
    include: {
      customer: { select: { id: true, companyName: true } },
      assignedDriver: { select: { id: true, name: true, phone: true } },
    },
  });

  return Response.json({ data: delivery });
}
