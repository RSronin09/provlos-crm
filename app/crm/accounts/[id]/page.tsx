import { AccountDetailActions } from "@/components/crm/account-detail-actions";
import { AccountDeliveriesCard } from "@/components/crm/account-deliveries-card";
import { AccountRecordEditableCards } from "@/components/crm/account-record-editable-cards";
import { AccountRecordHeaderActions } from "@/components/crm/account-record-header-actions";
import { DetailTabs } from "@/components/crm/ui/detail-tabs";
import { PageHeader } from "@/components/crm/ui/page-header";
import { RecordHeader } from "@/components/crm/ui/record-header";
import { RightRailCard } from "@/components/crm/ui/right-rail-card";
import { StageBadge } from "@/components/crm/ui/stage-badge";
import { StatusBadge } from "@/components/crm/ui/status-badge";
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
            <StatusBadge value={account.priorityScore ? `PRIORITY ${account.priorityScore}` : "PRIORITY N/A"} />
          </>
        }
        actions={
          <AccountRecordHeaderActions accountId={account.id} initialNotes={account.notes ?? ""} />
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

          <AccountRecordEditableCards
            accountId={account.id}
            account={{
              industry: account.industry,
              orgType: account.orgType,
              website: account.website,
              phone: account.phone,
              city: account.city,
              state: account.state,
              region: account.region,
              priorityScore: account.priorityScore,
              notes: account.notes,
            }}
            contacts={account.contacts.map((contact) => ({
              id: contact.id,
              title:
                contact.fullName ||
                `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
                "Unnamed contact",
              subtitle: contact.title ?? null,
              meta: `${contact.email ?? "No email"} | ${contact.phone ?? "No phone"}`,
            }))}
            activities={account.activities.map((activity) => ({
              id: activity.id,
              type: activity.type,
              content: activity.content,
              outcome: activity.outcome,
              occurredAt: activity.occurredAt.toISOString(),
            }))}
            tasks={account.tasks.map((task) => ({
              id: task.id,
              type: task.type,
              title: task.type,
              status: task.status,
              notes: task.notes,
              dueAt: task.dueAt?.toISOString() ?? null,
            }))}
          />

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
              <Link href="/crm/contacts" className="text-blue-700 hover:underline">
                All Contacts
              </Link>
              <Link href="/crm/tasks?view=open" className="text-blue-700 hover:underline">
                Open Tasks
              </Link>
              <Link href="/crm/pipeline" className="text-blue-700 hover:underline">
                Pipeline Board
              </Link>
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
          <AccountDeliveriesCard
            accountId={account.id}
            accountName={account.companyName}
          />
          <AccountDetailActions accountId={account.id} initialNotes={account.notes ?? ""} />
        </div>
      </div>
    </div>
  );
}
