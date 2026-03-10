import { DashboardCards } from "@/components/crm/dashboard-cards";
import { ActivityFeed } from "@/components/crm/ui/activity-feed";
import { MetricCard } from "@/components/crm/ui/metric-card";
import { PageHeader } from "@/components/crm/ui/page-header";
import { RightRailCard } from "@/components/crm/ui/right-rail-card";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function DashboardPage() {
  const [
    totalAccounts,
    contactsFound,
    openTasks,
    accountsByStage,
    recentActivities,
    upcomingTasks,
    highPriorityTargets,
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Operational snapshot across prospecting, discovery, and outreach."
      />

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
