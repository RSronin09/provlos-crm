import { db } from "@/lib/db";

export default async function CrmDashboardPage() {
  let accounts = 0;
  let contacts = 0;
  let openTasks = 0;
  let queuedJobs = 0;
  let accountsNeedingEnrichment = 0;
  let reachableContacts = 0;
  let dbWarning: string | null = null;

  try {
    [accounts, contacts, openTasks, queuedJobs, accountsNeedingEnrichment, reachableContacts] =
      await Promise.all([
      db.account.count(),
      db.contact.count(),
      db.task.count({ where: { status: "OPEN" } }),
      db.enrichmentJob.count({ where: { status: "QUEUED" } }),
      db.account.count({ where: { enrichmentStatus: { in: ["NOT_STARTED", "FAILED"] } } }),
      db.contact.count({ where: { isDoNotContact: false } }),
    ]);
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-slate-600">CRM v1 overview for pipeline and outreach prep.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Accounts" value={accounts} />
        <MetricCard label="Contacts" value={contacts} />
        <MetricCard label="Open Tasks" value={openTasks} />
        <MetricCard label="Queued Enrichment Jobs" value={queuedJobs} />
        <MetricCard label="Accounts Needing Enrichment" value={accountsNeedingEnrichment} />
        <MetricCard label="Reachable Contacts" value={reachableContacts} />
      </div>
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
