import { db } from "@/lib/db";
import { sortDeliveryQueue } from "@/lib/delivery-queue";
import { DriverMobilePanel } from "@/components/crm/driver-mobile-panel";
import { Prisma } from "@prisma/client";
import Link from "next/link";

type DeliveryWithCustomer = Prisma.DeliveryGetPayload<{
  include: { customer: { select: { companyName: true } } };
}>;

type DriverViewPageProps = {
  searchParams?: Promise<{ driverId?: string }>;
};

export default async function DriverViewPage({ searchParams }: DriverViewPageProps) {
  const params = (await searchParams) ?? {};
  const drivers = await db.driver.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const selectedDriverId = params.driverId ?? drivers[0]?.id ?? null;
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) ?? null;

  let deliveries: DeliveryWithCustomer[] = [];

  if (selectedDriverId) {
    const raw = await db.delivery.findMany({
      where: { assignedDriverId: selectedDriverId },
      include: { customer: { select: { companyName: true } } },
      orderBy: [
        { stopOrder: "asc" },
        { priorityLevel: "desc" },
        { requestedDeliveryDateTime: "asc" },
      ],
    });
    deliveries = sortDeliveryQueue(raw);
  }

  if (drivers.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-xl font-semibold text-slate-700">No active drivers found</p>
        <p className="text-sm text-slate-500">Ask your dispatcher to add you to the system.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-3 py-6">
      {/* Driver selector */}
      <form className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Select Your Name
        </label>
        <div className="flex gap-2">
          <select
            name="driverId"
            defaultValue={selectedDriverId ?? ""}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white"
          >
            Go
          </button>
        </div>
      </form>

      {selectedDriver ? (
        <DriverMobilePanel
          driverName={selectedDriver.name}
          driverId={selectedDriver.id}
          deliveries={deliveries.map((d) => ({
            id: d.id,
            pickupAddress: d.pickupAddress,
            deliveryAddress: d.deliveryAddress,
            pickupLat: d.pickupLat,
            pickupLng: d.pickupLng,
            deliveryLat: d.deliveryLat,
            deliveryLng: d.deliveryLng,
            requestedDeliveryDateTime: d.requestedDeliveryDateTime.toISOString(),
            pickupContactName: d.pickupContactName,
            pickupContactPhone: d.pickupContactPhone,
            deliveryContactName: d.deliveryContactName,
            deliveryContactPhone: d.deliveryContactPhone,
            packageNotes: d.packageNotes,
            priorityLevel: d.priorityLevel,
            status: d.status,
            stopOrder: d.stopOrder,
            customer: d.customer,
          }))}
        />
      ) : null}

      <div className="pt-2 text-center">
        <Link href="/crm/deliveries" className="text-xs text-slate-400 hover:underline">
          Admin View
        </Link>
      </div>
    </div>
  );
}
