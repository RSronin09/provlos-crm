import { db } from "@/lib/db";
import { TERMINAL_STATUSES, isOverdue, isAtRisk } from "@/lib/delivery-queue";
import { IssueStatus } from "@prisma/client";
import { LiveOperationsPanel } from "@/components/crm/live-operations-panel";
import type { LiveDriver, LiveDelivery } from "@/components/crm/live-operations-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LiveOperationsPage() {
  const [driversRaw, deliveriesRaw] = await Promise.all([
    db.driver.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleName: true,
        location: {
          select: { lat: true, lng: true, accuracy: true, capturedAt: true },
        },
        _count: {
          select: {
            deliveries: {
              where: { status: { notIn: TERMINAL_STATUSES } },
            },
          },
        },
        deliveries: {
          where: { status: { notIn: TERMINAL_STATUSES } },
          select: {
            id: true,
            status: true,
            deliveryAddress: true,
            requestedDeliveryDateTime: true,
            stopOrder: true,
            customer: { select: { companyName: true } },
          },
          orderBy: [{ stopOrder: "asc" }, { requestedDeliveryDateTime: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),

    db.delivery.findMany({
      where: { status: { notIn: TERMINAL_STATUSES } },
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        deliveryAddress: true,
        pickupLat: true,
        pickupLng: true,
        deliveryLat: true,
        deliveryLng: true,
        requestedDeliveryDateTime: true,
        priorityLevel: true,
        customer: { select: { companyName: true } },
        assignedDriver: { select: { id: true, name: true } },
        issues: { where: { status: IssueStatus.open }, select: { id: true } },
      },
      orderBy: { requestedDeliveryDateTime: "asc" },
    }),
  ]);

  const drivers: LiveDriver[] = driversRaw.map((d) => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    vehicleName: d.vehicleName,
    openCount: d._count.deliveries,
    location: d.location
      ? {
          lat: d.location.lat,
          lng: d.location.lng,
          capturedAt: d.location.capturedAt.toISOString(),
        }
      : null,
    deliveries: d.deliveries.map((del) => ({
      id: del.id,
      status: del.status,
      deliveryAddress: del.deliveryAddress,
      requestedDeliveryDateTime: del.requestedDeliveryDateTime.toISOString(),
      stopOrder: del.stopOrder,
      customer: del.customer,
    })),
  }));

  const deliveries: LiveDelivery[] = deliveriesRaw.map((d) => ({
    id: d.id,
    status: d.status,
    pickupAddress: d.pickupAddress,
    deliveryAddress: d.deliveryAddress,
    pickupLat: d.pickupLat,
    pickupLng: d.pickupLng,
    deliveryLat: d.deliveryLat,
    deliveryLng: d.deliveryLng,
    requestedDeliveryDateTime: d.requestedDeliveryDateTime.toISOString(),
    isOverdue: isOverdue(d),
    isAtRisk: isAtRisk(d),
    priorityLevel: d.priorityLevel,
    customer: d.customer,
    assignedDriver: d.assignedDriver,
  }));

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Live Operations</h1>
          <p className="text-sm text-slate-500">
            Real-time view of active drivers and open deliveries · Auto-refreshes every 30 s
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <LiveOperationsPanel initialDrivers={drivers} initialDeliveries={deliveries} />
      </div>
    </div>
  );
}
