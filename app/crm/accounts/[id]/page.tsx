import { AccountDetailActions } from "@/components/crm/account-detail-actions";
import { ActivityFeed } from "@/components/crm/ui/activity-feed";
import { ContactListCard } from "@/components/crm/ui/contact-list-card";
import { DetailTabs } from "@/components/crm/ui/detail-tabs";
import { PageHeader } from "@/components/crm/ui/page-header";
import { RecordHeader } from "@/components/crm/ui/record-header";
import { RightRailCard } from "@/components/crm/ui/right-rail-card";
import { StageBadge } from "@/components/crm/ui/stage-badge";
import { StatusBadge } from "@/components/crm/ui/status-badge";
import { TaskListCard } from "@/components/crm/ui/task-list-card";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

type AccountDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params;

  type AccountDetails = Prisma.AccountGetPayload<{
    include: { contacts: true; activities: true; tasks: true };
  }>;

  let account: AccountDetails | null;
  try {
    account = await db.account.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: [{ isDoNotContact: "asc" }, { lastName: "asc" }],
        },
        activities: {
          orderBy: { occurredAt: "desc" },
          take: 25,
        },
        tasks: {
          orderBy: [{ status: "asc" }, { dueAt: "asc" }],
          take: 25,
        },
        enrichmentJobs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
  } catch {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Database is unreachable. Check `DATABASE_URL` and run migrations.
      </div>
    );
  }

  if (!account) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Record"
        subtitle="CRM profile for company qualification, outreach, and follow-up tracking."
        actions={
          <Link href="/crm/accounts" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            Back to Accounts
          </Link>
        }
      />
      <RecordHeader
        title={account.companyName}
        subtitle={account.industry ?? "No industry specified"}
        badges={
          <>
            <StageBadge stage={account.stage} />
            <StatusBadge value={account.enrichmentStatus} />
            <StatusBadge value={account.priorityScore ? `PRIORITY ${account.priorityScore}` : "PRIORITY N/A"} />
          </>
        }
        actions={
          <>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Edit Account</button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Add Contact</button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Log Activity</button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Create Task</button>
            <button className="rounded-md bg-blue-700 px-3 py-2 text-sm text-white">Enqueue Enrichment</button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          <DetailTabs
            tabs={[
              { id: "contacts", label: "Contacts" },
              { id: "activities", label: "Activities" },
              { id: "tasks", label: "Tasks" },
              { id: "timeline", label: "Timeline" },
            ]}
          />

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Overview</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Industry" value={account.industry} />
              <Field label="Org Type" value={account.orgType} />
              <Field label="Website" value={account.website} />
              <Field label="Phone" value={account.phone} />
              <Field label="City" value={account.city} />
              <Field label="State" value={account.state} />
              <Field label="Region" value={account.region} />
              <Field label="Priority Score" value={account.priorityScore?.toString()} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Notes</h3>
            <p className="text-sm text-slate-600">{account.notes ?? "No notes saved."}</p>
          </section>

          <section id="contacts" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <ContactListCard
              title="Contacts"
              contacts={account.contacts.map((contact) => ({
                id: contact.id,
                title:
                  contact.fullName ||
                  `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
                  "Unnamed contact",
                subtitle: contact.title ?? "No title",
                meta: `${contact.email ?? "No email"} | ${contact.phone ?? "No phone"}`,
              }))}
            />
          </section>

          <section id="activities" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Activities</h3>
            <ActivityFeed
              items={account.activities.map((activity) => ({
                id: activity.id,
                title: activity.type,
                content: activity.content ?? activity.outcome,
                timestamp: activity.occurredAt.toISOString().slice(0, 16).replace("T", " "),
              }))}
            />
          </section>

          <section id="tasks" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <TaskListCard
              title="Tasks"
              tasks={account.tasks.map((task) => ({
                id: task.id,
                title: task.type,
                subtitle: task.notes ?? undefined,
                status: task.status,
              }))}
            />
          </section>

          <section id="timeline" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Timeline</h3>
            <ActivityFeed
              items={[
                ...account.activities.map((activity) => ({
                  id: `activity-${activity.id}`,
                  title: `Activity: ${activity.type}`,
                  content: activity.content ?? activity.outcome,
                  timestamp: activity.occurredAt.toISOString().slice(0, 16).replace("T", " "),
                })),
                ...account.tasks.map((task) => ({
                  id: `task-${task.id}`,
                  title: `Task ${task.status}: ${task.type}`,
                  content: task.notes,
                  timestamp: task.updatedAt.toISOString().slice(0, 16).replace("T", " "),
                })),
              ].sort((a, b) => b.timestamp.localeCompare(a.timestamp))}
            />
          </section>
        </div>

        <div className="space-y-4">
          <RightRailCard title="Account Details">
            <ul className="space-y-1 text-sm text-slate-700">
              <li>Phone: {account.phone ?? "-"}</li>
              <li>Website: {account.website ?? "-"}</li>
              <li>State: {account.state ?? "-"}</li>
              <li>Region: {account.region ?? "-"}</li>
            </ul>
          </RightRailCard>
          <RightRailCard title="Contact Summary">
            <p className="text-sm text-slate-700">{account.contacts.length} contacts in this account.</p>
          </RightRailCard>
          <RightRailCard title="Open Tasks">
            <p className="text-sm text-slate-700">
              {account.tasks.filter((task) => task.status === "OPEN").length} open tasks.
            </p>
          </RightRailCard>
          <RightRailCard title="Recent Activity">
            <p className="text-sm text-slate-700">{account.activities.length} logged activities.</p>
          </RightRailCard>
          <RightRailCard title="Quick Links">
            <div className="flex flex-col gap-2 text-sm">
              {account.website ? (
                <a href={account.website} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                  Website
                </a>
              ) : (
                <span className="text-slate-500">Website unavailable</span>
              )}
              <a
                href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(account.companyName)}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 hover:underline"
              >
                LinkedIn Search
              </a>
            </div>
          </RightRailCard>
          <AccountDetailActions accountId={account.id} initialNotes={account.notes ?? ""} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{value || "-"}</dd>
    </div>
  );
}
