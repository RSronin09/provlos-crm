import { db } from "@/lib/db";
import { AccountStage, EnrichmentStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/crm/ui/data-table";
import { EmptyState } from "@/components/crm/ui/empty-state";
import { FilterBar } from "@/components/crm/ui/filter-bar";
import { PageHeader } from "@/components/crm/ui/page-header";
import { SearchInput } from "@/components/crm/ui/search-input";
import { StageBadge } from "@/components/crm/ui/stage-badge";
import { StatusBadge } from "@/components/crm/ui/status-badge";

type AccountsPageProps = {
  searchParams?: {
    search?: string;
    industry?: string;
    stage?: AccountStage;
    enrichmentStatus?: EnrichmentStatus;
    state?: string;
    region?: string;
    sort?: string;
    direction?: "asc" | "desc";
  };
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const filters = searchParams ?? {};
  const sort = filters.sort ?? "updatedAt";
  const direction = filters.direction === "asc" ? "asc" : "desc";

  let dbWarning: string | null = null;
  type AccountListRow = Prisma.AccountGetPayload<{
    include: { _count: { select: { contacts: true } } };
  }>;
  let accounts: AccountListRow[] = [];

  try {
    accounts = await db.account.findMany({
      where: {
        ...(filters.search
          ? {
              OR: [
                { companyName: { contains: filters.search, mode: "insensitive" } },
                { website: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(filters.industry
          ? { industry: { equals: filters.industry, mode: "insensitive" } }
          : {}),
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.enrichmentStatus ? { enrichmentStatus: filters.enrichmentStatus } : {}),
        ...(filters.state ? { state: { equals: filters.state, mode: "insensitive" } } : {}),
        ...(filters.region ? { region: { equals: filters.region, mode: "insensitive" } } : {}),
      },
      include: { _count: { select: { contacts: true } } },
      orderBy: { [sort]: direction },
      take: 200,
    });
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" subtitle="Company records, lifecycle stages, and enrichment readiness." />

      <FilterBar>
        <SearchInput
          name="search"
          placeholder="Search company / website"
          defaultValue={filters.search}
          className="md:col-span-2"
        />
        <input
          type="text"
          name="industry"
          placeholder="Industry"
          defaultValue={filters.industry}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="stage"
          defaultValue={filters.stage ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All stages</option>
          {Object.values(AccountStage).map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
        <select
          name="enrichmentStatus"
          defaultValue={filters.enrichmentStatus ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All enrichment statuses</option>
          {Object.values(EnrichmentStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="text"
            name="state"
            placeholder="State"
            defaultValue={filters.state}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            name="region"
            placeholder="Region"
            defaultValue={filters.region}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="updatedAt">Last Updated</option>
          <option value="companyName">Company Name</option>
          <option value="industry">Industry</option>
          <option value="stage">Stage</option>
          <option value="priorityScore">Priority Score</option>
        </select>
        <select
          name="direction"
          defaultValue={direction}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white"
        >
          Apply
        </button>
      </FilterBar>

      <DataTable
        headers={[
          "Company Name",
          "Industry",
          "Stage",
          "Priority Score",
          "Enrichment Status",
          "Contacts Count",
          "Phone",
          "Website",
          "Region",
          "Last Updated",
        ]}
      >
        {accounts.map((account) => (
          <tr key={account.id} className="border-t border-slate-200 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium">
              <Link href={`/crm/accounts/${account.id}`} className="hover:underline">
                {account.companyName}
              </Link>
            </td>
            <td className="px-4 py-3">{account.industry ?? "-"}</td>
            <td className="px-4 py-3">
              <StageBadge stage={account.stage} />
            </td>
            <td className="px-4 py-3">{account.priorityScore ?? "-"}</td>
            <td className="px-4 py-3">
              <StatusBadge value={account.enrichmentStatus} />
            </td>
            <td className="px-4 py-3">{account._count.contacts}</td>
            <td className="px-4 py-3">{account.phone ?? "-"}</td>
            <td className="px-4 py-3">
              {account.website ? (
                <a href={account.website} className="text-blue-700 hover:underline" target="_blank" rel="noreferrer">
                  Website
                </a>
              ) : (
                "-"
              )}
            </td>
            <td className="px-4 py-3">{[account.state, account.region].filter(Boolean).join(" / ") || "-"}</td>
            <td className="px-4 py-3">{account.updatedAt.toISOString().slice(0, 10)}</td>
          </tr>
        ))}
      </DataTable>
      {accounts.length === 0 ? (
        <EmptyState title="No accounts found" description="Try adjusting filters or importing targets first." />
      ) : null}
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}
