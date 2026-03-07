import { db } from "@/lib/db";
import { DashboardCards } from "@/components/crm/dashboard-cards";

export default async function CrmDashboardPage() {
  let accounts = 0;
  let contacts = 0;
  let openTasks = 0;
  let queuedJobs = 0;
  let accountsNeedingEnrichment = 0;
  let reachableContacts = 0;
  let accountItems: { title: string; subtitle?: string; meta?: string; href?: string; badge?: string }[] = [];
  let contactItems: { title: string; subtitle?: string; meta?: string; href?: string; badge?: string }[] = [];
  let openTaskItems: { title: string; subtitle?: string; meta?: string; href?: string; badge?: string }[] = [];
  let queuedJobItems: { title: string; subtitle?: string; meta?: string; href?: string; badge?: string }[] = [];
  let accountNeedItems: { title: string; subtitle?: string; meta?: string; href?: string; badge?: string }[] = [];
  let reachableContactItems: { title: string; subtitle?: string; meta?: string; href?: string; badge?: string }[] = [];
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
        select: { id: true, companyName: true, stage: true, state: true, region: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      db.contact.findMany({
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          title: true,
          account: { select: { id: true, companyName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      db.task.findMany({
        where: { status: "OPEN" },
        select: { id: true, type: true, dueAt: true, account: { select: { id: true, companyName: true } } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 10,
      }),
      db.enrichmentJob.findMany({
        where: { status: "QUEUED" },
        select: {
          id: true,
          jobType: true,
          createdAt: true,
          account: { select: { id: true, companyName: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      db.account.findMany({
        where: { enrichmentStatus: { in: ["NOT_STARTED", "FAILED"] } },
        select: { id: true, companyName: true, enrichmentStatus: true, stage: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      db.contact.findMany({
        where: { isDoNotContact: false },
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          email: true,
          account: { select: { id: true, companyName: true } },
        },
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

    accountItems = accountRows.map((row) => ({
      title: row.companyName,
      subtitle: [row.state, row.region].filter(Boolean).join(" - ") || "No location set",
      badge: row.stage,
      href: `/crm/accounts/${row.id}`,
    }));
    contactItems = contactRows.map((row) => {
      const fullName = row.fullName || `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "Unnamed";
      return {
        title: fullName,
        subtitle: row.title || "No title",
        meta: row.account.companyName,
        href: `/crm/accounts/${row.account.id}`,
      };
    });
    openTaskItems = openTaskRows.map((row) => {
      const due = row.dueAt ? row.dueAt.toISOString().slice(0, 10) : "No due date";
      return {
        title: row.account.companyName,
        subtitle: `Task: ${row.type}`,
        meta: `Due: ${due}`,
        badge: "OPEN",
        href: "/crm/tasks",
      };
    });
    queuedJobItems = queuedJobRows.map((row) => ({
      title: row.account.companyName,
      subtitle: `Job: ${row.jobType}`,
      meta: `Queued at ${row.createdAt.toISOString().slice(0, 16).replace("T", " ")}`,
      badge: "QUEUED",
      href: `/crm/accounts/${row.account.id}`,
    }));
    accountNeedItems = accountNeedRows.map((row) => ({
      title: row.companyName,
      subtitle: `Stage: ${row.stage}`,
      badge: row.enrichmentStatus,
      href: `/crm/accounts/${row.id}`,
    }));
    reachableContactItems = reachableContactRows.map((row) => {
      const fullName = row.fullName || `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "Unnamed";
      return {
        title: fullName,
        subtitle: row.email || "No email",
        meta: row.account.companyName,
        href: `/crm/accounts/${row.account.id}`,
      };
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
