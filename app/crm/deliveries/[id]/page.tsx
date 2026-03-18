import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { DeliveryStatusBadge } from "@/components/crm/ui/delivery-status-badge";
import { PriorityBadge } from "@/components/crm/ui/priority-badge";
import { PageHeader } from "@/components/crm/ui/page-header";
import { RightRailCard } from "@/components/crm/ui/right-rail-card";
import { DeliveryDetailActions } from "@/components/crm/delivery-detail-actions";
import Link from "next/link";

type DeliveryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeliveryDetailPage({ params }: DeliveryDetailPageProps) {
  const { id } = await params;

  const [delivery, drivers] = await Promise.all([
    db.delivery.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, companyName: true } },
        assignedDriver: { select: { id: true, name: true, phone: true, email: true } },
        statusHistory: { orderBy: { changedAt: "desc" } },
      },
    }),
    db.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!delivery) notFound();

  const shortId = delivery.id.slice(0, 8).toUpperCase();

  function formatDt(dt: Date | null) {
    if (!dt) return "—";
    return dt.toISOString().slice(0, 16).replace("T", " ");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Delivery #${shortId}`}
        subtitle={delivery.customer?.companyName ?? "No customer linked"}
        actions={
          <Link
            href="/crm/deliveries/all"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← All Deliveries
          </Link>
        }
      />

      {/* Status + priority strip */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <DeliveryStatusBadge status={delivery.status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</span>
          <PriorityBadge priority={delivery.priorityLevel} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</span>
          <span className="text-sm font-medium text-slate-800">
            {delivery.assignedDriver?.name ?? "—"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        {/* Left — full details */}
        <div className="space-y-4">
          {/* Addresses */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Addresses
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="font-medium text-slate-700 mb-1">Pickup</p>
                <p className="text-slate-600 whitespace-pre-wrap">{delivery.pickupAddress}</p>
                {delivery.pickupContactName ? (
                  <p className="mt-2 text-slate-500">
                    {delivery.pickupContactName}
                    {delivery.pickupContactPhone ? ` · ${delivery.pickupContactPhone}` : ""}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="font-medium text-slate-700 mb-1">Delivery</p>
                <p className="text-slate-600 whitespace-pre-wrap">{delivery.deliveryAddress}</p>
                {delivery.deliveryContactName ? (
                  <p className="mt-2 text-slate-500">
                    {delivery.deliveryContactName}
                    {delivery.deliveryContactPhone ? ` · ${delivery.deliveryContactPhone}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Scheduling */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Scheduling
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-slate-500">Pickup Date/Time</p>
                <p className="font-medium text-slate-800">{formatDt(delivery.pickupDateTime)}</p>
              </div>
              <div>
                <p className="text-slate-500">Requested Delivery</p>
                <p className="font-medium text-slate-800">{formatDt(delivery.requestedDeliveryDateTime)}</p>
              </div>
              <div>
                <p className="text-slate-500">Created</p>
                <p className="font-medium text-slate-800">{formatDt(delivery.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-500">Last Updated</p>
                <p className="font-medium text-slate-800">{formatDt(delivery.updatedAt)}</p>
              </div>
            </div>
          </div>

          {/* Package Notes */}
          {delivery.packageNotes ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Package Notes / Instructions
              </h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{delivery.packageNotes}</p>
            </div>
          ) : null}

          {/* Status History */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Status History
            </h3>
            {delivery.statusHistory.length === 0 ? (
              <p className="text-sm text-slate-500">No history yet.</p>
            ) : (
              <ul className="space-y-2">
                {delivery.statusHistory.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
                    <span className="text-slate-400 shrink-0">{formatDt(h.changedAt)}</span>
                    <span className="text-slate-500 shrink-0">
                      {h.oldStatus ? h.oldStatus.replace(/_/g, " ") : "—"}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="font-medium text-slate-800">
                      {h.newStatus.replace(/_/g, " ")}
                    </span>
                    <span className="text-slate-400">by {h.changedBy}</span>
                    {h.note ? <span className="text-slate-500 italic">"{h.note}"</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right rail — admin actions */}
        <div className="space-y-4">
          {delivery.assignedDriver ? (
            <RightRailCard title="Assigned Driver">
              <div className="space-y-1 text-sm">
                <p className="font-medium text-slate-800">{delivery.assignedDriver.name}</p>
                {delivery.assignedDriver.phone ? (
                  <p className="text-slate-500">{delivery.assignedDriver.phone}</p>
                ) : null}
                {delivery.assignedDriver.email ? (
                  <p className="text-slate-500">{delivery.assignedDriver.email}</p>
                ) : null}
              </div>
            </RightRailCard>
          ) : null}

          {delivery.customer ? (
            <RightRailCard title="Customer Account">
              <Link
                href={`/crm/accounts/${delivery.customer.id}`}
                className="text-sm text-blue-700 hover:underline"
              >
                {delivery.customer.companyName}
              </Link>
            </RightRailCard>
          ) : null}

          <DeliveryDetailActions
            deliveryId={delivery.id}
            currentStatus={delivery.status}
            currentPriority={delivery.priorityLevel}
            currentDriverId={delivery.assignedDriverId}
            drivers={drivers}
          />
        </div>
      </div>
    </div>
  );
}
