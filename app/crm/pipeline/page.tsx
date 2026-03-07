import Link from "next/link";
import { PageHeader } from "@/components/crm/ui/page-header";
import { StageBadge } from "@/components/crm/ui/stage-badge";
import { db } from "@/lib/db";

const STAGES = [
  "TARGET",
  "ENRICHING",
  "ENRICHED",
  "CONTACTED",
  "ENGAGED",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
] as const;

export default async function PipelinePage() {
  const accounts = await db.account.findMany({
    include: {
      _count: { select: { contacts: true, activities: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const byStage = Object.fromEntries(STAGES.map((stage) => [stage, accounts.filter((a) => a.stage === stage)]));

  return (
    <div className="space-y-6">
      <PageHeader title="Pipeline" subtitle="Kanban view of account progression across CRM stages." />

      <div className="grid gap-4 xl:grid-cols-3">
        {STAGES.map((stage) => (
          <section key={stage} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <StageBadge stage={stage} />
              <span className="text-xs text-slate-500">{byStage[stage].length}</span>
            </div>
            <div className="space-y-2">
              {byStage[stage].map((account) => (
                <Link
                  key={account.id}
                  href={`/crm/accounts/${account.id}`}
                  className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100"
                >
                  <p className="text-sm font-medium">{account.companyName}</p>
                  <p className="text-xs text-slate-600">{account.industry ?? "No industry"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Priority: {account.priorityScore ?? "-"} | Contacts: {account._count.contacts} | Last Activity:{" "}
                    {account._count.activities}
                  </p>
                </Link>
              ))}
              {!byStage[stage].length ? (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500">
                  No accounts in this stage.
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
