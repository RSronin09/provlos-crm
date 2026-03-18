import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { isOverdue, isAtRisk } from "@/lib/delivery-queue";
import { IssueStatus } from "@prisma/client";
import { DeliveryStatusBadge } from "@/components/crm/ui/delivery-status-badge";
import { PriorityBadge } from "@/components/crm/ui/priority-badge";
import { PageHeader } from "@/components/crm/ui/page-header";
import { RightRailCard } from "@/components/crm/ui/right-rail-card";
import { DeliveryDetailActions } from "@/components/crm/delivery-detail-actions";
import { DeliveryTimeline } from "@/components/crm/delivery-timeline";
import { DeliveryNotesPanel } from "@/components/crm/delivery-notes-panel";
import { DeliveryIssuePanel } from "@/components/crm/delivery-issue-panel";
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
        issues: { orderBy: { createdAt: "desc" } },
      },
    }),
    db.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!delivery) notFound();

  const shortId = delivery.id.slice(0, 8).toUpperCase();
  const overdue = isOverdue(delivery);
  const atRisk = isAtRisk(delivery, 2);
  const openIssueCount = delivery.issues.filter((i) => i.status === IssueStatus.open).length;

  function fmt(dt: Date | null): string {
    if (!dt) return "—";
    return dt.toISOString().slice(0, 16).replace("T", " ");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Delivery #${shortId}`}
        subtitle={delivery.customer?.companyName ?? "No customer linked"}
        actions={
          <div className="flex gap-2">
            <Link
              href="/crm/deliveries/dispatch"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Dispatch Board
            </Link>
            <Link
              href="/crm/deliveries/all"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← All Deliveries
            </Link>
          </div>
        }
      />

      {/* At-risk / overdue banner */}
      {overdue ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">
          ⚠ This delivery is <strong>overdue</strong> — it passed the requested delivery deadline at{" "}
          {fmt(delivery.requestedDeliveryDateTime)}.
        </div>
      ) : atRisk ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-700">
          ⏱ At Risk — deadline is within 2 hours ({fmt(delivery.requestedDeliveryDateTime)}).
        </div>
      ) : null}

      {openIssueCount > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {openIssueCount} open issue{openIssueCount > 1 ? "s" : ""} on this delivery — see Issue Log below.
        </div>
      ) : null}

      {/* Status/priority/driver strip */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
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
            {delivery.assignedDriver?.name ?? (
              <span className="text-rose-500">Unassigned</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due</span>
          <span className={`text-sm font-medium ${overdue ? "text-rose-600" : atRisk ? "text-amber-600" : "text-slate-800"}`}>
            {fmt(delivery.requestedDeliveryDateTime)}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        {/* LEFT: full record */}
        <div className="space-y-4">
          {/* Section 1: Delivery Summary */}
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
                    {delivery.pickupContactPhone ? (
                      <>
                        {" · "}
                        <a href={`tel:${delivery.pickupContactPhone}`} className="text-blue-700 hover:underline">
                          {delivery.pickupContactPhone}
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="font-medium text-slate-700 mb-1">Delivery</p>
                <p className="text-slate-600 whitespace-pre-wrap">{delivery.deliveryAddress}</p>
                {delivery.deliveryContactName ? (
                  <p className="mt-2 text-slate-500">
                    {delivery.deliveryContactName}
                    {delivery.deliveryContactPhone ? (
                      <>
                        {" · "}
                        <a href={`tel:${delivery.deliveryContactPhone}`} className="text-blue-700 hover:underline">
                          {delivery.deliveryContactPhone}
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Section 2: CRM / Customer context */}
          {delivery.customer ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Customer Account
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{delivery.customer.companyName}</p>
                  <Link
                    href={`/crm/deliveries/all?customerId=${delivery.customer.id}`}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    View all deliveries for this account →
                  </Link>
                </div>
                <Link
                  href={`/crm/accounts/${delivery.customer.id}`}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  CRM Record
                </Link>
              </div>
            </div>
          ) : null}

          {/* Package Notes */}
          {delivery.packageNotes ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
                Package Notes / Instructions
              </h3>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{delivery.packageNotes}</p>
            </div>
          ) : null}

          {/* Section 3: Timeline */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Delivery Timeline
            </h3>
            <DeliveryTimeline
              history={delivery.statusHistory.map((h) => ({
                id: h.id,
                oldStatus: h.oldStatus,
                newStatus: h.newStatus,
                changedBy: h.changedBy,
                changedAt: h.changedAt.toISOString(),
                note: h.note,
              }))}
              phases={{
                createdAt: delivery.createdAt.toISOString(),
                assignedAt: delivery.assignedAt?.toISOString() ?? null,
                pickedUpAt: delivery.pickedUpAt?.toISOString() ?? null,
                deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
                cancelledAt: delivery.cancelledAt?.toISOString() ?? null,
              }}
            />
          </div>

          {/* Section 4: Dispatcher Notes */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Dispatcher Notes
            </h3>
            <DeliveryNotesPanel
              deliveryId={delivery.id}
              initialNotes={delivery.dispatcherNotes}
            />
          </div>

          {/* Section 5: Issue Log */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Issue Log
            </h3>
            <DeliveryIssuePanel
              deliveryId={delivery.id}
              issues={delivery.issues.map((i) => ({
                id: i.id,
                issueType: i.issueType,
                reportedBy: i.reportedBy,
                note: i.note,
                status: i.status,
                createdAt: i.createdAt.toISOString(),
                resolvedAt: i.resolvedAt?.toISOString() ?? null,
                resolvedBy: i.resolvedBy,
                resolveNote: i.resolveNote,
              }))}
              canReport={false}
            />
          </div>
        </div>

        {/* RIGHT: admin actions */}
        <div className="space-y-4">
          {delivery.assignedDriver ? (
            <RightRailCard title="Assigned Driver">
              <div className="space-y-1 text-sm">
                <p className="font-medium text-slate-800">{delivery.assignedDriver.name}</p>
                {delivery.assignedDriver.phone ? (
                  <a href={`tel:${delivery.assignedDriver.phone}`} className="block text-blue-700 hover:underline">
                    {delivery.assignedDriver.phone}
                  </a>
                ) : null}
                {delivery.assignedDriver.email ? (
                  <p className="text-slate-500">{delivery.assignedDriver.email}</p>
                ) : null}
              </div>
            </RightRailCard>
          ) : null}

          <DeliveryDetailActions
            deliveryId={delivery.id}
            currentStatus={delivery.status}
            currentPriority={delivery.priorityLevel}
            currentDriverId={delivery.assignedDriverId}
            drivers={drivers}
          />

          {/* Scheduling summary */}
          <RightRailCard title="Scheduling">
            <div className="space-y-2 text-sm">
              {[
                { label: "Requested", value: fmt(delivery.requestedDeliveryDateTime) },
                { label: "Pickup Window", value: fmt(delivery.pickupDateTime) },
                { label: "Created", value: fmt(delivery.createdAt) },
                { label: "Last Updated", value: fmt(delivery.updatedAt) },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-2">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-medium text-slate-800">{row.value}</span>
                </div>
              ))}
            </div>
          </RightRailCard>
        </div>
      </div>
    </div>
  );
}
