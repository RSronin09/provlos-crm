import { db } from "@/lib/db";
import { getDriverWorkload } from "@/lib/delivery-queue";
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
    recentDeliveries,
    driverWorkload,
  ] = await Promise.all([
    db.delivery.count({ where: { status: "pending" } }),
    db.delivery.count({ where: { status: "assigned" } }),
    db.delivery.count({
      where: { status: { in: ["en_route_to_pickup", "picked_up", "en_route_to_delivery"] } },
    }),
    db.delivery.count({
      where: { status: "delivered", updatedAt: { gte: today, lt: tomorrow } },
    }),
    db.delivery.count({ where: { status: "issue_reported" } }),
    db.delivery.findMany({
      take: 10,
      orderBy: [{ priorityLevel: "desc" }, { requestedDeliveryDateTime: "asc" }],
      include: {
        customer: { select: { companyName: true } },
        assignedDriver: { select: { name: true } },
      },
      where: { status: { notIn: ["delivered", "cancelled"] } },
    }),
    getDriverWorkload(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Dashboard"
        subtitle="Live operational snapshot for dispatch and tracking."
        actions={
          <Link
            href="/crm/deliveries/create"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            + New Delivery
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Pending"
          value={pendingCount}
          footer={
            <Link href="/crm/deliveries/all?status=pending" className="text-xs text-blue-700 hover:underline">
              View pending
            </Link>
          }
        />
        <MetricCard
          label="Assigned"
          value={assignedCount}
          footer={
            <Link href="/crm/deliveries/all?status=assigned" className="text-xs text-blue-700 hover:underline">
              View assigned
            </Link>
          }
        />
        <MetricCard
          label="In Progress"
          value={inProgressCount}
          hint="En route / picked up"
          footer={
            <Link href="/crm/deliveries/all?status=en_route_to_pickup" className="text-xs text-blue-700 hover:underline">
              View in progress
            </Link>
          }
        />
        <MetricCard
          label="Delivered Today"
          value={deliveredTodayCount}
          footer={
            <Link href="/crm/deliveries/all?status=delivered" className="text-xs text-blue-700 hover:underline">
              View delivered
            </Link>
          }
        />
        <MetricCard
          label="Issues Reported"
          value={issueCount}
          footer={
            <Link href="/crm/deliveries/all?status=issue_reported" className="text-xs text-blue-700 hover:underline">
              View issues
            </Link>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Active Queue</h2>
            <Link href="/crm/deliveries/all" className="text-sm text-blue-700 hover:underline">
              View all
            </Link>
          </div>

          {recentDeliveries.length === 0 ? (
            <EmptyState
              title="No active deliveries"
              description="Create a new delivery to get started."
            />
          ) : (
            <DataTable
              headers={["Customer", "Delivery Address", "Requested By", "Driver", "Priority", "Status"]}
            >
              {recentDeliveries.map((d) => (
                <tr key={d.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/deliveries/${d.id}`} className="hover:underline">
                      {d.customer?.companyName ?? "—"}
                    </Link>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                    {d.deliveryAddress}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {d.requestedDeliveryDateTime.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">{d.assignedDriver?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={d.priorityLevel} />
                  </td>
                  <td className="px-4 py-3">
                    <DeliveryStatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Driver Workload</h2>
            <Link href="/crm/deliveries/drivers" className="text-sm text-blue-700 hover:underline">
              Manage drivers
            </Link>
          </div>

          {driverWorkload.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No active drivers. <Link href="/crm/deliveries/drivers" className="text-blue-700 hover:underline">Add a driver</Link> to get started.
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {driverWorkload.map((driver) => (
                  <li key={driver.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-slate-800">{driver.name}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        driver.openDeliveries === 0
                          ? "bg-slate-100 text-slate-500"
                          : driver.openDeliveries >= 3
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {driver.openDeliveries} open
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
