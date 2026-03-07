import { DataTable } from "@/components/crm/ui/data-table";
import { EmptyState } from "@/components/crm/ui/empty-state";
import { PageHeader } from "@/components/crm/ui/page-header";
import { StatusBadge } from "@/components/crm/ui/status-badge";
import { db } from "@/lib/db";
import { EnrichmentQueueActions } from "@/components/crm/enrichment-queue-actions";

export default async function EnrichmentQueuePage() {
  const jobs = await db.enrichmentJob.findMany({
    include: { account: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Enrichment Queue" subtitle="Monitor job execution and process enrichment one job at a time." />
      <EnrichmentQueueActions />
      <DataTable
        headers={[
          "Job Type",
          "Account",
          "Status",
          "Attempt Count",
          "Last Error",
          "Created At",
          "Started At",
          "Finished At",
        ]}
      >
        {jobs.map((job) => (
          <tr key={job.id} className="border-t border-slate-200 hover:bg-slate-50">
            <td className="px-4 py-3">{job.jobType}</td>
            <td className="px-4 py-3">{job.account.companyName}</td>
            <td className="px-4 py-3">
              <StatusBadge value={job.status} />
            </td>
            <td className="px-4 py-3">{job.attemptCount}</td>
            <td className="px-4 py-3">{job.lastError ?? "-"}</td>
            <td className="px-4 py-3">{job.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            <td className="px-4 py-3">{job.startedAt ? job.startedAt.toISOString().slice(0, 16).replace("T", " ") : "-"}</td>
            <td className="px-4 py-3">{job.finishedAt ? job.finishedAt.toISOString().slice(0, 16).replace("T", " ") : "-"}</td>
          </tr>
        ))}
      </DataTable>
      {!jobs.length ? (
        <EmptyState title="No enrichment jobs queued" description="Enqueue accounts from account pages or discovery flow." />
      ) : null}
    </div>
  );
}
