import { db } from "@/lib/db";
import { DashboardCards } from "@/components/crm/dashboard-cards";

export default async function CrmDashboardPage() {
  let accounts = 0;
  let contacts = 0;
  let openTasks = 0;
  let queuedJobs = 0;
  let accountsNeedingEnrichment = 0;
  let reachableContacts = 0;
  let accountItems: string[] = [];
  let contactItems: string[] = [];
  let openTaskItems: string[] = [];
  let queuedJobItems: string[] = [];
  let accountNeedItems: string[] = [];
  let reachableContactItems: string[] = [];
  let dbWarning: string | null = null;

  try {
    const [
      accountCount,
      contactCount,
      openTaskCount,
      queuedJobCount,
      accountNeedCount,
      reachableContactCount,
      accountRows,
      contactRows,
      openTaskRows,
      queuedJobRows,
      accountNeedRows,
      reachableContactRows,
    ] = await Promise.all([
      db.account.count(),
      db.contact.count(),
      db.task.count({ where: { status: "OPEN" } }),
      db.enrichmentJob.count({ where: { status: "QUEUED" } }),
      db.account.count({ where: { enrichmentStatus: { in: ["NOT_STARTED", "FAILED"] } } }),
      db.contact.count({ where: { isDoNotContact: false } }),
      db.account.findMany({
        select: { companyName: true, stage: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      db.contact.findMany({
        select: { fullName: true, firstName: true, lastName: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      db.task.findMany({
        where: { status: "OPEN" },
        select: { type: true, dueAt: true, account: { select: { companyName: true } } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 10,
      }),
      db.enrichmentJob.findMany({
        where: { status: "QUEUED" },
        select: { jobType: true, account: { select: { companyName: true } } },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      db.account.findMany({
        where: { enrichmentStatus: { in: ["NOT_STARTED", "FAILED"] } },
        select: { companyName: true, enrichmentStatus: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      db.contact.findMany({
        where: { isDoNotContact: false },
        select: { fullName: true, firstName: true, lastName: true, email: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    accounts = accountCount;
    contacts = contactCount;
    openTasks = openTaskCount;
    queuedJobs = queuedJobCount;
    accountsNeedingEnrichment = accountNeedCount;
    reachableContacts = reachableContactCount;

    accountItems = accountRows.map((row) => `${row.companyName} (${row.stage})`);
    contactItems = contactRows.map((row) => {
      const fullName = row.fullName || `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "Unnamed";
      return `${fullName}${row.title ? ` - ${row.title}` : ""}`;
    });
    openTaskItems = openTaskRows.map((row) => {
      const due = row.dueAt ? row.dueAt.toISOString().slice(0, 10) : "No due date";
      return `${row.account.companyName} - ${row.type} (${due})`;
    });
    queuedJobItems = queuedJobRows.map((row) => `${row.account.companyName} - ${row.jobType}`);
    accountNeedItems = accountNeedRows.map(
      (row) => `${row.companyName} (${row.enrichmentStatus})`,
    );
    reachableContactItems = reachableContactRows.map((row) => {
      const fullName = row.fullName || `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "Unnamed";
      return `${fullName}${row.email ? ` - ${row.email}` : ""}`;
    });
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-slate-600">CRM v1 overview for pipeline and outreach prep.</p>
      </div>
      <DashboardCards
        cards={[
          {
            id: "accounts",
            label: "Accounts",
            value: accounts,
            items: accountItems,
            emptyMessage: "No accounts yet.",
          },
          {
            id: "contacts",
            label: "Contacts",
            value: contacts,
            items: contactItems,
            emptyMessage: "No contacts yet.",
          },
          {
            id: "open-tasks",
            label: "Open Tasks",
            value: openTasks,
            items: openTaskItems,
            emptyMessage: "No open tasks.",
          },
          {
            id: "queued-jobs",
            label: "Queued Enrichment Jobs",
            value: queuedJobs,
            items: queuedJobItems,
            emptyMessage: "No queued enrichment jobs.",
          },
          {
            id: "need-enrichment",
            label: "Accounts Needing Enrichment",
            value: accountsNeedingEnrichment,
            items: accountNeedItems,
            emptyMessage: "No accounts waiting for enrichment.",
          },
          {
            id: "reachable-contacts",
            label: "Reachable Contacts",
            value: reachableContacts,
            items: reachableContactItems,
            emptyMessage: "No reachable contacts yet.",
          },
        ]}
      />
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}
