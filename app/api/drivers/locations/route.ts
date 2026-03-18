import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OPEN_STATUSES } from "@/lib/delivery-queue";

/**
 * GET /api/drivers/locations
 * Returns all active drivers with their latest known location and open delivery count.
 * Used by the Live Operations map to render driver pins.
 */
export async function GET() {
  const drivers = await db.driver.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      phone: true,
      vehicleName: true,
      location: {
        select: {
          lat: true,
          lng: true,
          accuracy: true,
          capturedAt: true,
        },
      },
      _count: {
        select: {
          deliveries: { where: { status: { in: OPEN_STATUSES } } },
        },
      },
      deliveries: {
        where: { status: { in: OPEN_STATUSES } },
        select: {
          id: true,
          status: true,
          deliveryAddress: true,
          requestedDeliveryDateTime: true,
          stopOrder: true,
          customer: { select: { companyName: true } },
        },
        orderBy: [
          { stopOrder: "asc" },
          { requestedDeliveryDateTime: "asc" },
        ],
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ drivers });
}
