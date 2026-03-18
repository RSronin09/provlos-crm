import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { driverLocationSchema } from "@/lib/crm-validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/drivers/[id]/location
 * Store or update the driver's latest GPS location.
 * Called periodically by the driver mobile view when active.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.json();
  const parsed = driverLocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const driver = await db.driver.findUnique({ where: { id } });
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const location = await db.driverLocation.upsert({
    where: { driverId: id },
    create: {
      driverId: id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      accuracy: parsed.data.accuracy ?? null,
    },
    update: {
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      accuracy: parsed.data.accuracy ?? null,
      capturedAt: new Date(),
    },
  });

  return NextResponse.json({ location });
}

/**
 * GET /api/drivers/[id]/location
 * Get the latest known location for a specific driver.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const location = await db.driverLocation.findUnique({
    where: { driverId: id },
  });

  if (!location) {
    return NextResponse.json({ location: null });
  }

  return NextResponse.json({ location });
}
