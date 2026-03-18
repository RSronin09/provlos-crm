import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OPEN_STATUSES } from "@/lib/delivery-queue";
import { recommendSequenceForDriver } from "@/lib/delivery-eta";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/drivers/[id]/resequence
 * Auto-assign recommended stopOrder to all of a driver's open deliveries.
 * Uses recommendSequenceForDriver() which considers urgency, deadline, and proximity.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const driver = await db.driver.findUnique({
    where: { id },
    include: { location: true },
  });
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const deliveries = await db.delivery.findMany({
    where: {
      assignedDriverId: id,
      status: { in: OPEN_STATUSES },
    },
    select: {
      id: true,
      status: true,
      priorityLevel: true,
      requestedDeliveryDateTime: true,
      stopOrder: true,
      pickupLat: true,
      pickupLng: true,
      deliveryLat: true,
      deliveryLng: true,
    },
  });

  if (deliveries.length === 0) {
    return NextResponse.json({ message: "No open deliveries to sequence", updated: 0 });
  }

  const sequenced = recommendSequenceForDriver(
    deliveries,
    driver.location?.lat ?? null,
    driver.location?.lng ?? null,
  );

  await db.$transaction(
    sequenced.map((d, i) =>
      db.delivery.update({
        where: { id: d.id },
        data: { stopOrder: i + 1 },
      }),
    ),
  );

  return NextResponse.json({
    message: "Resequenced successfully",
    updated: sequenced.length,
    sequence: sequenced.map((d, i) => ({ id: d.id, stopOrder: i + 1 })),
  });
}
