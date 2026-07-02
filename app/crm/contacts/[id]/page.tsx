import Link from "next/link";
import { ContactRecordActions } from "@/components/crm/contact-record-actions";
import { ContactTaskList } from "@/components/crm/contact-task-list";
import { EditablePersonInfo } from "@/components/crm/editable-person-info";
import { PageHeader } from "@/components/crm/ui/page-header";
import { RightRailCard } from "@/components/crm/ui/right-rail-card";
import { ActivityFeed } from "@/components/crm/ui/activity-feed";
import { db } from "@/lib/db";
import { getActivityTypeLabel, getTaskTypeLabel } from "@/lib/activity-labels";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";

type ContactDetailProps = {
  params: Promise<{ id: string }>;
};

export default async function ContactDetailPage({ params }: ContactDetailProps) {
  const { id } = await params;

  let contact: Prisma.ContactGetPayload<{
    include: { account: true; activities: true; tasks: true };
  }> | null = null;
  let dbWarning: string | null = null;

  try {
    contact = await db.contact.findUnique({
      where: { id },
      include: {
        account: true,
        activities: { orderBy: { occurredAt: "desc" }, take: 20 },
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 20 },
      },
    });
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  if (dbWarning) {
    return (
      <div className="space-y-6">
        <PageHeader title="Contact" />
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      </div>
    );
  }

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
          <EditablePersonInfo
            contactId={contact.id}
            fullName={fullName}
            title={contact.title}
            email={contact.email}
            phone={contact.phone}
            department={contact.department}
            linkedinUrl={contact.linkedinUrl}
            confidenceScore={contact.confidenceScore}
            source={contact.source}
          />

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Outreach History</h3>
            <ActivityFeed
              items={contact.activities.map((activity) => ({
                id: activity.id,
                title: getActivityTypeLabel(activity.type),
                content: activity.content ?? activity.outcome,
                timestamp: activity.occurredAt.toISOString().slice(0, 16).replace("T", " "),
              }))}
            />
          </section>

          <ContactTaskList
            title="Tasks"
            tasks={contact.tasks.map((task) => ({
              id: task.id,
              title: getTaskTypeLabel(task.type),
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
              <Link href={`/crm/accounts/${contact.accountId}`} className="text-blue-700 hover:underline">
                Account Record
              </Link>
              <Link href={`/crm/contacts?accountId=${contact.accountId}`} className="text-blue-700 hover:underline">
                Other Contacts at {contact.account.companyName}
              </Link>
              {contact.account.accountType === "CUSTOMER" ? (
                <Link href="/crm/pipeline" className="text-blue-700 hover:underline">
                  Pipeline Board
                </Link>
              ) : null}
              <Link href="/crm/tasks?view=open" className="text-blue-700 hover:underline">
                Open Tasks
              </Link>
              <Link href="/crm/contacts" className="text-blue-700 hover:underline">
                All Contacts
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
