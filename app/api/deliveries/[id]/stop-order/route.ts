import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deliveryStopOrderSchema } from "@/lib/crm-validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/deliveries/[id]/stop-order
 * Set or clear the stop order for a delivery.
 * Admin/dispatcher only.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.json();
  const parsed = deliveryStopOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const delivery = await db.delivery.findUnique({ where: { id } });
  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const updated = await db.delivery.update({
    where: { id },
    data: { stopOrder: parsed.data.stopOrder },
    select: { id: true, stopOrder: true },
  });

  return NextResponse.json({ delivery: updated });
}
