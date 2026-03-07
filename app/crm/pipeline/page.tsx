import { PageHeader } from "@/components/crm/ui/page-header";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { db } from "@/lib/db";

export default async function PipelinePage() {
  const [accounts, latestByAccount] = await Promise.all([
    db.account.findMany({
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

  const cards = accounts.map((account) => ({
    id: account.id,
    companyName: account.companyName,
    industry: account.industry,
    stage: account.stage,
    priorityScore: account.priorityScore,
    contactsCount: account._count.contacts,
    lastActivityAt: latestMap[account.id] ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        subtitle="Drag and drop accounts across stages. Every move requires a note."
      />
      <PipelineBoard accounts={cards} />
    </div>
  );
}
