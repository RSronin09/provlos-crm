import { db } from "@/lib/db";
import {
  getDriverWorkload,
  getOverdueCount,
  getUnassignedCount,
  getRecentDeliveryActivity,
  getDispatchQueueOrder,
  computeDeliveryPriorityScore,
  isOverdue,
  isAtRisk,
  TERMINAL_STATUSES,
  IN_PROGRESS_STATUSES,
} from "@/lib/delivery-queue";
import { IssueStatus } from "@prisma/client";
import { DeliveryStatusBadge } from "@/components/crm/ui/delivery-status-badge";
import { PriorityBadge } from "@/components/crm/ui/priority-badge";
import { MetricCard } from "@/components/crm/ui/metric-card";
import { PageHeader } from "@/components/crm/ui/page-header";
import { DataTable } from "@/components/crm/ui/data-table";
import { EmptyState } from "@/components/crm/ui/empty-state";
import Link from "next/link";

export default async function DeliveryDashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    pendingCount,
    assignedCount,
    inProgressCount,
    deliveredTodayCount,
    issueCount,
    overdueCount,
    unassignedCount,
    dispatchQueue,
    driverWorkload,
    recentActivity,
  ] = await Promise.all([
    db.delivery.count({ where: { status: "pending" } }),
    db.delivery.count({ where: { status: "assigned" } }),
    db.delivery.count({ where: { status: { in: IN_PROGRESS_STATUSES } } }),
    db.delivery.count({
      where: { status: "delivered", deliveredAt: { gte: today, lt: tomorrow } },
    }),
    db.delivery.count({ where: { status: "issue_reported" } }),
    getOverdueCount(),
    getUnassignedCount(),
    db.delivery.findMany({
      where: { status: { notIn: TERMINAL_STATUSES } },
      include: {
        customer: { select: { companyName: true } },
        assignedDriver: { select: { name: true } },
        issues: { where: { status: IssueStatus.open }, select: { id: true } },
      },
      orderBy: [{ priorityLevel: "desc" }, { requestedDeliveryDateTime: "asc" }],
      take: 50,
    }),
    getDriverWorkload(),
    getRecentDeliveryActivity(10),
  ]);

  const sortedQueue = getDispatchQueueOrder(dispatchQueue).slice(0, 15);

  const STATUS_EVENT_LABEL: Record<string, string> = {
    pending: "created",
    assigned: "assigned",
    en_route_to_pickup: "en route to pickup",
    picked_up: "picked up",
    en_route_to_delivery: "en route to delivery",
    delivered: "delivered",
    issue_reported: "issue reported",
    cancelled: "cancelled",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Dashboard"
        subtitle="Live dispatch control center."
        actions={
          <div className="flex gap-2">
            <Link
              href="/crm/deliveries/dispatch"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Dispatch Board
            </Link>
            <Link
              href="/crm/deliveries/create"
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              + New Delivery
            </Link>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <MetricCard label="Pending" value={pendingCount}
          footer={<Link href="/crm/deliveries/all?status=pending" className="text-xs text-blue-700 hover:underline">View</Link>} />
        <MetricCard label="Unassigned" value={unassignedCount}
          footer={<Link href="/crm/deliveries/all?unassignedOnly=true" className="text-xs text-blue-700 hover:underline">View</Link>} />
        <MetricCard label="Assigned" value={assignedCount}
          footer={<Link href="/crm/deliveries/all?status=assigned" className="text-xs text-blue-700 hover:underline">View</Link>} />
        <MetricCard label="In Progress" value={inProgressCount} hint="En route / picked up"
          footer={<Link href="/crm/deliveries/all?status=en_route_to_pickup" className="text-xs text-blue-700 hover:underline">View</Link>} />
        <MetricCard label="Delivered Today" value={deliveredTodayCount}
          footer={<Link href="/crm/deliveries/all?status=delivered" className="text-xs text-blue-700 hover:underline">View</Link>} />
        <MetricCard label="Issues" value={issueCount}
          footer={<Link href="/crm/deliveries/all?hasIssue=true" className="text-xs text-blue-700 hover:underline">View</Link>} />
        <MetricCard label="Overdue" value={overdueCount} hint="Past deadline"
          footer={<Link href="/crm/deliveries/all?overdueOnly=true" className="text-xs text-rose-700 hover:underline">View</Link>} />
      </div>

      {/* Two-column main content */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Left: Dispatch Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Dispatch Queue</h2>
            <Link href="/crm/deliveries/all?openOnly=true" className="text-sm text-blue-700 hover:underline">
              View all open
            </Link>
          </div>

          {sortedQueue.length === 0 ? (
            <EmptyState title="Queue is clear" description="All deliveries are completed or cancelled." />
          ) : (
            <DataTable headers={["#", "Customer", "Delivery To", "Due", "Driver", "Pri", "Status", ""]}>
              {sortedQueue.map((d, idx) => {
                const overdue = isOverdue(d);
                const atRisk = isAtRisk(d, 2);
                const score = computeDeliveryPriorityScore(d);
                const hasOpenIssue = d.issues.length > 0;

                return (
                  <tr
                    key={d.id}
                    className={`border-t border-slate-200 hover:bg-slate-50 ${
                      overdue ? "bg-rose-50" : atRisk ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-medium">
                      <Link href={`/crm/deliveries/${d.id}`} className="hover:underline text-sm">
                        {d.customer?.companyName ?? "—"}
                      </Link>
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-slate-500">
                      {d.deliveryAddress}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <span className={overdue ? "font-semibold text-rose-600" : atRisk ? "font-semibold text-amber-600" : "text-slate-500"}>
                        {d.requestedDeliveryDateTime.toISOString().slice(0, 10)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {d.assignedDriver?.name ?? (
                        <span className="font-medium text-rose-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <PriorityBadge priority={d.priorityLevel} />
                    </td>
                    <td className="px-3 py-2.5">
                      <DeliveryStatusBadge status={d.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {hasOpenIssue ? (
                        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">!</span>
                      ) : (
                        <span className="text-[10px] text-slate-300">{score}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </div>

        {/* Right: Driver Workload + Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Driver Workload</h2>
            <Link href="/crm/deliveries/drivers" className="text-sm text-blue-700 hover:underline">
              Manage
            </Link>
          </div>

          {driverWorkload.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
              No active drivers. <Link href="/crm/deliveries/drivers" className="text-blue-700 hover:underline">Add one</Link>.
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
              {driverWorkload.map((driver) => (
                <div key={driver.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{driver.name}</p>
                    {driver.nextDeliveryAt ? (
                      <p className="text-xs text-slate-400">
                        Next: {new Date(driver.nextDeliveryAt).toISOString().slice(0, 10)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{driver.openDeliveries} open</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        driver.load === "low"
                          ? "bg-emerald-100 text-emerald-700"
                          : driver.load === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {driver.load}
                    </span>
                    {driver.inProgress ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="In progress" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Activity Feed */}
          <div className="flex items-center justify-between pt-2">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            {recentActivity.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentActivity.map((event) => (
                  <li key={event.id} className="px-4 py-2.5">
                    <p className="text-sm text-slate-700">
                      <Link
                        href={`/crm/deliveries/${event.deliveryId}`}
                        className="font-medium hover:underline"
                      >
                        {event.delivery.customer?.companyName ?? event.delivery.deliveryAddress.slice(0, 30)}
                      </Link>{" "}
                      <span className="text-slate-500">
                        {STATUS_EVENT_LABEL[event.newStatus] ?? event.newStatus.replace(/_/g, " ")}
                      </span>{" "}
                      <span className="text-slate-400 text-xs">by {event.changedBy}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {event.changedAt.toISOString().slice(0, 16).replace("T", " ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
