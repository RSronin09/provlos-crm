import { PageHeader } from "@/components/crm/ui/page-header";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { EmptyState } from "@/components/crm/ui/empty-state";
import { db } from "@/lib/db";
import { AccountStage } from "@prisma/client";
import Link from "next/link";

export default async function PipelinePage() {
  let dbWarning: string | null = null;
  let cards: {
    id: string;
    companyName: string;
    industry: string | null;
    stage: AccountStage;
    priorityScore: number | null;
    contactsCount: number;
    lastActivityAt: string | null;
  }[] = [];

  try {
    const [accounts, latestByAccount] = await Promise.all([
      db.account.findMany({
        where: { accountType: "CUSTOMER" },
        include: {
          _count: { select: { contacts: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.activity.groupBy({
        by: ["accountId"],
        _max: { occurredAt: true },
      }),
    ]);

    const latestMap = Object.fromEntries(
      latestByAccount.map((row) => [row.accountId, row._max.occurredAt?.toISOString() ?? null]),
    );

    cards = accounts.map((account) => ({
      id: account.id,
      companyName: account.companyName,
      industry: account.industry,
      stage: account.stage,
      priorityScore: account.priorityScore,
      contactsCount: account._count.contacts,
      lastActivityAt: latestMap[account.id] ?? null,
    }));
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Pipeline"
        subtitle="Customer accounts by stage. Drag to move — each move requires a note."
      />
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : cards.length === 0 ? (
        <EmptyState
          title="No customer accounts yet"
          description="Add a customer relationship to start tracking it through the pipeline."
          action={
            <Link
              href="/crm/relationships/new"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Add Relationship
            </Link>
          }
        />
      ) : (
        <PipelineBoard accounts={cards} />
      )}
    </div>
  );
}
