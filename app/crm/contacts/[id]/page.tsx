import Link from "next/link";
import { ContactRecordActions } from "@/components/crm/contact-record-actions";
import { PageHeader } from "@/components/crm/ui/page-header";
import { RightRailCard } from "@/components/crm/ui/right-rail-card";
import { TaskListCard } from "@/components/crm/ui/task-list-card";
import { ActivityFeed } from "@/components/crm/ui/activity-feed";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

type ContactDetailProps = {
  params: Promise<{ id: string }>;
};

export default async function ContactDetailPage({ params }: ContactDetailProps) {
  const { id } = await params;
  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      account: true,
      activities: { orderBy: { occurredAt: "desc" }, take: 20 },
      tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 20 },
    },
  });

  if (!contact) notFound();

  const fullName =
    contact.fullName || `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unnamed contact";

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        subtitle={`${contact.title ?? "No title"} - ${contact.account.companyName}`}
        actions={
          <div className="min-w-[320px]">
            <ContactRecordActions accountId={contact.accountId} contactId={contact.id} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Person Info</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Email" value={contact.email} />
              <Field label="Phone" value={contact.phone} />
              <Field label="Department" value={contact.department} />
              <Field label="LinkedIn" value={contact.linkedinUrl} />
              <Field label="Confidence" value={contact.confidenceScore?.toFixed(2)} />
              <Field label="Source" value={contact.source} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Outreach History</h3>
            <ActivityFeed
              items={contact.activities.map((activity) => ({
                id: activity.id,
                title: activity.type,
                content: activity.content ?? activity.outcome,
                timestamp: activity.occurredAt.toISOString().slice(0, 16).replace("T", " "),
              }))}
            />
          </section>

          <TaskListCard
            title="Tasks"
            tasks={contact.tasks.map((task) => ({
              id: task.id,
              title: task.type,
              subtitle: task.notes ?? undefined,
              status: task.status,
            }))}
          />
        </div>

        <div className="space-y-4">
          <RightRailCard title="Associated Account">
            <Link href={`/crm/accounts/${contact.accountId}`} className="text-sm text-blue-700 hover:underline">
              {contact.account.companyName}
            </Link>
          </RightRailCard>
          <RightRailCard title="Related Tabs">
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/crm/contacts" className="text-blue-700 hover:underline">
                All Contacts
              </Link>
              <Link href={`/crm/accounts/${contact.accountId}`} className="text-blue-700 hover:underline">
                Account Record
              </Link>
              <Link href="/crm/tasks?view=open" className="text-blue-700 hover:underline">
                Open Tasks
              </Link>
            </div>
          </RightRailCard>
          <RightRailCard title="Quick Actions">
            <ContactRecordActions accountId={contact.accountId} contactId={contact.id} compact />
          </RightRailCard>
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
