import { db } from "@/lib/db";
import { DeliveryStatusBadge } from "@/components/crm/ui/delivery-status-badge";
import { PriorityBadge } from "@/components/crm/ui/priority-badge";
import Link from "next/link";

type AccountDeliveriesCardProps = {
  accountId: string;
  accountName: string;
};

export async function AccountDeliveriesCard({
  accountId,
  accountName,
}: AccountDeliveriesCardProps) {
  const deliveries = await db.delivery.findMany({
    where: { customerId: accountId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      assignedDriver: { select: { name: true } },
    },
  });

  const openCount = deliveries.filter(
    (d) => d.status !== "delivered" && d.status !== "cancelled"
  ).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Deliveries
        </h3>
        <div className="flex items-center gap-2">
          {openCount > 0 ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {openCount} open
            </span>
          ) : null}
          <Link
            href={`/crm/deliveries/create?customerId=${accountId}`}
            className="rounded-md bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800"
          >
            + New
          </Link>
        </div>
      </div>

      {deliveries.length === 0 ? (
        <p className="text-sm text-slate-400">No deliveries yet for this account.</p>
      ) : (
        <ul className="space-y-2">
          {deliveries.map((d) => (
            <li key={d.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/crm/deliveries/${d.id}`}
                    className="block truncate text-xs font-medium text-blue-700 hover:underline"
                  >
                    {d.deliveryAddress}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {d.requestedDeliveryDateTime.toISOString().slice(0, 10)}
                    {d.assignedDriver ? ` · ${d.assignedDriver.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <DeliveryStatusBadge status={d.status} />
                  <PriorityBadge priority={d.priorityLevel} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deliveries.length >= 5 ? (
        <Link
          href={`/crm/deliveries/all?customerId=${accountId}`}
          className="mt-3 block text-xs text-blue-700 hover:underline"
        >
          View all deliveries for {accountName} →
        </Link>
      ) : null}
    </section>
  );
}
