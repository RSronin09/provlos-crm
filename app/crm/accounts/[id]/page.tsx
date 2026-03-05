import { AccountDetailActions } from "@/components/crm/account-detail-actions";
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/crm/accounts" className="text-sm text-slate-600 hover:underline">
            Back to Accounts
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">{account.companyName}</h2>
          <p className="text-sm text-slate-600">
            Stage: {account.stage} | Enrichment: {account.enrichmentStatus}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <div className="flex gap-2 text-sm">
            <a href="#contacts" className="rounded-md border border-slate-300 px-3 py-1.5">
              Contacts
            </a>
            <a href="#activities" className="rounded-md border border-slate-300 px-3 py-1.5">
              Activities
            </a>
            <a href="#tasks" className="rounded-md border border-slate-300 px-3 py-1.5">
              Tasks
            </a>
          </div>

          <section className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-lg font-semibold">Account Summary</h3>
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

          <section id="contacts" className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-lg font-semibold">Contacts</h3>
            <ul className="space-y-2 text-sm">
              {account.contacts.map((contact) => (
                <li key={contact.id} className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="font-medium">
                    {contact.fullName || `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unnamed contact"}
                  </div>
                  <div className="text-slate-600">
                    {contact.title ?? "-"} | {contact.email ?? "-"} | DNC:{" "}
                    {contact.isDoNotContact ? "Yes" : "No"}
                  </div>
                </li>
              ))}
              {account.contacts.length === 0 ? <li className="text-slate-500">No contacts yet.</li> : null}
            </ul>
          </section>

          <section id="activities" className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-lg font-semibold">Activities</h3>
            <ul className="space-y-2 text-sm">
              {account.activities.map((activity) => (
                <li key={activity.id} className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="font-medium">{activity.type}</div>
                  <div className="text-slate-600">{activity.content ?? activity.outcome ?? "-"}</div>
                </li>
              ))}
              {account.activities.length === 0 ? <li className="text-slate-500">No activities yet.</li> : null}
            </ul>
          </section>

          <section id="tasks" className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-lg font-semibold">Tasks</h3>
            <ul className="space-y-2 text-sm">
              {account.tasks.map((task) => (
                <li key={task.id} className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="font-medium">
                    {task.type} ({task.status})
                  </div>
                  <div className="text-slate-600">{task.notes ?? "-"}</div>
                </li>
              ))}
              {account.tasks.length === 0 ? <li className="text-slate-500">No tasks yet.</li> : null}
            </ul>
          </section>
        </div>

        <AccountDetailActions accountId={account.id} initialNotes={account.notes ?? ""} />
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
