import { DashboardCards } from "@/components/crm/dashboard-cards";
import { ActivityFeed } from "@/components/crm/ui/activity-feed";
import { MetricCard } from "@/components/crm/ui/metric-card";
import { PageHeader } from "@/components/crm/ui/page-header";
import { RightRailCard } from "@/components/crm/ui/right-rail-card";
import { db } from "@/lib/db";
import { TERMINAL_STATUSES, OPEN_STATUSES } from "@/lib/delivery-queue";
import { IssueStatus, DeliveryStatus } from "@prisma/client";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  en_route_to_pickup: "En Route to Pickup",
  picked_up: "Picked Up",
  en_route_to_delivery: "En Route to Delivery",
  delivered: "Delivered",
  issue_reported: "Issue Reported",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  assigned: "bg-blue-100 text-blue-700",
  en_route_to_pickup: "bg-indigo-100 text-indigo-700",
  picked_up: "bg-purple-100 text-purple-700",
  en_route_to_delivery: "bg-violet-100 text-violet-700",
  delivered: "bg-emerald-100 text-emerald-700",
  issue_reported: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-400",
};

export default async function DashboardPage() {
  const now = new Date();

  const [
    totalAccounts,
    contactsFound,
    openTasks,
    accountsByStage,
    recentActivities,
    upcomingTasks,
    highPriorityTargets,
    // Delivery metrics
    activeDeliveries,
    overdueDeliveries,
    openIssues,
    unassignedDeliveries,
    todayDelivered,
    recentDeliveryActivity,
    inProgressDeliveries,
  ] = await Promise.all([
    db.account.count(),
    db.contact.count(),
    db.task.count({ where: { status: "OPEN" } }),
    db.account.groupBy({ by: ["stage"], _count: { stage: true } }),
    db.activity.findMany({
      take: 8,
      orderBy: { occurredAt: "desc" },
      include: { account: true },
    }),
    db.task.findMany({
      where: { status: { in: ["OPEN", "SNOOZED"] } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: { account: true, contact: true },
      take: 8,
    }),
    db.account.findMany({
      where: { priorityScore: { gte: 70 } },
      orderBy: { priorityScore: "desc" },
      take: 8,
    }),
    // Active (non-terminal)
    db.delivery.count({ where: { status: { notIn: TERMINAL_STATUSES } } }),
    // Overdue
    db.delivery.count({
      where: {
        status: { notIn: TERMINAL_STATUSES },
        requestedDeliveryDateTime: { lt: now },
      },
    }),
    // Open issues
    db.deliveryIssue.count({ where: { status: IssueStatus.open } }),
    // Unassigned
    db.delivery.count({
      where: {
        status: DeliveryStatus.pending,
        assignedDriverId: null,
      },
    }),
    // Delivered today
    db.delivery.count({
      where: {
        status: DeliveryStatus.delivered,
        deliveredAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
    }),
    // Recent delivery status changes
    db.deliveryStatusHistory.findMany({
      take: 6,
      orderBy: { changedAt: "desc" },
      include: {
        delivery: {
          select: {
            id: true,
            deliveryAddress: true,
            customer: { select: { companyName: true } },
          },
        },
      },
    }),
    // Currently in-progress deliveries
    db.delivery.findMany({
      where: { status: { in: OPEN_STATUSES } },
      select: {
        id: true,
        status: true,
        deliveryAddress: true,
        requestedDeliveryDateTime: true,
        priorityLevel: true,
        customer: { select: { companyName: true } },
        assignedDriver: { select: { name: true } },
      },
      orderBy: { requestedDeliveryDateTime: "asc" },
      take: 6,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Operational snapshot across prospecting, discovery, and outreach."
      />

      {/* CRM metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Accounts"
          value={totalAccounts}
          footer={
            <Link href="/crm/accounts" className="text-xs text-blue-700 hover:underline">
              Open accounts
            </Link>
          }
        />
        <MetricCard
          label="Contacts Found"
          value={contactsFound}
          footer={
            <Link href="/crm/contacts" className="text-xs text-blue-700 hover:underline">
              Open contacts
            </Link>
          }
        />
        <MetricCard
          label="Open Tasks"
          value={openTasks}
          footer={
            <Link href="/crm/tasks?view=open" className="text-xs text-blue-700 hover:underline">
              Open tasks view
            </Link>
          }
        />
        <MetricCard
          label="Accounts by Stage"
          value={accountsByStage.length}
          hint="Distinct populated stages"
          footer={
            <Link href="/crm/pipeline" className="text-xs text-blue-700 hover:underline">
              Open pipeline
            </Link>
          }
        />
      </div>

      {/* Delivery operations summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Delivery Operations
          </h2>
          <div className="flex gap-2">
            <Link
              href="/crm/deliveries/dispatch"
              className="text-xs text-blue-700 hover:underline"
            >
              Dispatch Board →
            </Link>
            <span className="text-xs text-slate-300">·</span>
            <Link
              href="/crm/deliveries/live"
              className="text-xs text-blue-700 hover:underline"
            >
              Live Map →
            </Link>
          </div>
        </div>

        {/* Delivery KPI cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              label: "Active",
              value: activeDeliveries,
              color: "text-blue-700",
              href: "/crm/deliveries?openOnly=true",
            },
            {
              label: "Unassigned",
              value: unassignedDeliveries,
              color: unassignedDeliveries > 0 ? "text-amber-600" : "text-slate-700",
              href: "/crm/deliveries/all?unassignedOnly=true",
            },
            {
              label: "Overdue",
              value: overdueDeliveries,
              color: overdueDeliveries > 0 ? "text-rose-600" : "text-slate-700",
              href: "/crm/deliveries/all?overdueOnly=true",
            },
            {
              label: "Open Issues",
              value: openIssues,
              color: openIssues > 0 ? "text-rose-700" : "text-slate-700",
              href: "/crm/deliveries/all?hasIssue=true",
            },
            {
              label: "Delivered Today",
              value: todayDelivered,
              color: "text-emerald-700",
              href: "/crm/deliveries/all",
            },
          ].map((k) => (
            <Link
              key={k.label}
              href={k.href}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300 hover:shadow transition-shadow"
            >
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-slate-500">{k.label}</div>
            </Link>
          ))}
        </div>

        {/* Delivery activity + in-progress */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent delivery events */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Recent Delivery Activity</h3>
              <Link href="/crm/deliveries" className="text-xs text-blue-700 hover:underline">
                Full dashboard →
              </Link>
            </div>
            {recentDeliveryActivity.length === 0 ? (
              <p className="text-sm text-slate-400">No delivery activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentDeliveryActivity.map((event) => (
                  <li key={event.id} className="flex items-start gap-2.5 text-xs">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 font-medium ${
                        STATUS_COLOR[event.newStatus] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {STATUS_LABEL[event.newStatus] ?? event.newStatus}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/crm/deliveries/${event.delivery.id}`}
                        className="font-medium text-slate-800 hover:underline truncate block"
                      >
                        {event.delivery.customer?.companyName ?? event.delivery.deliveryAddress}
                      </Link>
                      <span className="text-slate-400">
                        {new Date(event.changedAt).toLocaleString()}
                        {event.changedBy ? ` · ${event.changedBy}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active deliveries in progress */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Active Queue</h3>
              <Link
                href="/crm/deliveries/all?openOnly=true"
                className="text-xs text-blue-700 hover:underline"
              >
                All open →
              </Link>
            </div>
            {inProgressDeliveries.length === 0 ? (
              <p className="text-sm text-slate-400">No active deliveries right now.</p>
            ) : (
              <ul className="space-y-2">
                {inProgressDeliveries.map((d) => {
                  const isOverdue = d.requestedDeliveryDateTime < now;
                  return (
                    <li key={d.id}>
                      <Link
                        href={`/crm/deliveries/${d.id}`}
                        className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs hover:bg-slate-50 ${
                          isOverdue
                            ? "border-rose-200 bg-rose-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className={`font-medium truncate ${isOverdue ? "text-rose-800" : "text-slate-800"}`}>
                            {d.customer?.companyName ?? d.deliveryAddress}
                          </p>
                          <p className={`truncate ${isOverdue ? "text-rose-500" : "text-slate-400"}`}>
                            {d.assignedDriver?.name ?? "Unassigned"} ·{" "}
                            {isOverdue ? "⚠ Overdue" : `Due ${new Date(d.requestedDeliveryDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 font-medium ${
                            STATUS_COLOR[d.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {STATUS_LABEL[d.status] ?? d.status}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <DashboardCards
        cards={[
          {
            id: "accounts-by-stage",
            label: "Accounts by Stage",
            value: totalAccounts,
            items: accountsByStage.map((row) => ({
              title: row.stage,
              subtitle: `${row._count.stage} accounts`,
              badge: row.stage,
            })),
            emptyMessage: "No staged accounts yet.",
          },
          {
            id: "upcoming-tasks",
            label: "Upcoming Tasks",
            value: upcomingTasks.length,
            items: upcomingTasks.map((task) => ({
              title: task.account.companyName,
              subtitle: `${task.type}${task.contact?.fullName ? ` - ${task.contact.fullName}` : ""}`,
              meta: task.dueAt ? `Due ${task.dueAt.toISOString().slice(0, 10)}` : "No due date",
              href: "/crm/tasks",
              badge: task.status,
            })),
            emptyMessage: "No upcoming tasks.",
          },
          {
            id: "high-priority-targets",
            label: "High priority targets",
            value: highPriorityTargets.length,
            items: highPriorityTargets.map((account) => ({
              title: account.companyName,
              subtitle: `Priority ${account.priorityScore ?? 0}`,
              href: `/crm/accounts/${account.id}`,
              badge: account.stage,
            })),
            emptyMessage: "No high priority targets yet.",
          },
          {
            id: "recent-activity",
            label: "Recent Activity",
            value: recentActivities.length,
            items: recentActivities.map((activity) => ({
              title: activity.account.companyName,
              subtitle: activity.type,
              meta: activity.occurredAt.toISOString().slice(0, 16).replace("T", " "),
              href: `/crm/accounts/${activity.accountId}`,
            })),
            emptyMessage: "No recent activity yet.",
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Recent Activity</h3>
          <ActivityFeed
            items={recentActivities.map((activity) => ({
              id: activity.id,
              title: `${activity.account.companyName} - ${activity.type}`,
              content: activity.content ?? activity.outcome ?? null,
              timestamp: activity.occurredAt.toISOString().slice(0, 16).replace("T", " "),
            }))}
          />
        </section>

        <div className="space-y-4">
          <RightRailCard title="Upcoming Tasks">
            <ul className="space-y-2 text-sm">
              {upcomingTasks.map((task) => (
                <li key={task.id} className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="font-medium">{task.account.companyName}</p>
                  <p className="text-slate-600">
                    {task.type} {task.dueAt ? `- due ${task.dueAt.toISOString().slice(0, 10)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </RightRailCard>
        </div>
      </div>
    </div>
  );
}
