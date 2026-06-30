import { db } from "@/lib/db";
import { AccountStage, AccountType, Prisma } from "@prisma/client";
import Link from "next/link";
import { BulkEnrichPanel } from "@/components/crm/bulk-enrich-panel";
import { EnrichAccountRowButton } from "@/components/crm/enrich-account-row-button";
import { DataTable } from "@/components/crm/ui/data-table";
import { EmptyState } from "@/components/crm/ui/empty-state";
import { FilterBar } from "@/components/crm/ui/filter-bar";
import { PageHeader } from "@/components/crm/ui/page-header";
import { SearchInput } from "@/components/crm/ui/search-input";
import { StageBadge } from "@/components/crm/ui/stage-badge";
import { AccountTypeBadge } from "@/components/crm/ui/account-type-badge";
import {
  ACCOUNT_TYPE_CONFIG,
  ACCOUNT_TYPE_VALUES,
  AccountType as LocalAccountType,
  getTypeConfig,
} from "@/lib/account-types";

const TYPE_SLUG: Record<LocalAccountType, string> = {
  CUSTOMER: "customers",
  VENDOR: "vendors",
  BANK: "banks",
  SUPPLIER: "suppliers",
  PARTNER: "partners",
  OTHER: "other",
};

type RelationshipListPageProps = {
  searchParams?: {
    search?: string;
    industry?: string;
    stage?: AccountStage;
    state?: string;
    region?: string;
    sort?: string;
    direction?: "asc" | "desc";
  };
  /** When set, restricts the list to a single relationship type */
  fixedType?: LocalAccountType;
};

export async function RelationshipListPage({
  searchParams,
  fixedType,
}: RelationshipListPageProps) {
  const filters = searchParams ?? {};
  const sort = filters.sort ?? "updatedAt";
  const direction = filters.direction === "asc" ? "asc" : "desc";
  const typeConfig = fixedType ? getTypeConfig(fixedType) : null;

  let dbWarning: string | null = null;
  type AccountListRow = Prisma.AccountGetPayload<{
    include: { _count: { select: { contacts: true } } };
  }>;
  let accounts: AccountListRow[] = [];

  try {
    accounts = await db.account.findMany({
      where: {
        ...(fixedType ? { accountType: fixedType as AccountType } : {}),
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

  const title = typeConfig ? typeConfig.pluralLabel : "All Relationships";
  const subtitle = typeConfig
    ? typeConfig.description
    : "All companies, vendors, banks, suppliers, and partners — unified view.";

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            {accounts.length > 0 && (
              <BulkEnrichPanel
                accounts={accounts.map((a) => ({
                  id: a.id,
                  companyName: a.companyName,
                  contactCount: a._count.contacts,
                }))}
                entityLabel={typeConfig ? typeConfig.pluralLabel.toLowerCase() : "accounts"}
              />
            )}
            <Link
              href="/crm/relationships/new"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Add Relationship
            </Link>
          </div>
        }
      />

      {/* Type tab strip — only shown on the "All Relationships" page */}
      {!fixedType ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/crm/relationships"
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            All
          </Link>
          {ACCOUNT_TYPE_VALUES.map((type) => {
            const cfg = ACCOUNT_TYPE_CONFIG[type];
            return (
              <Link
                key={type}
                href={`/crm/relationships/${TYPE_SLUG[type]}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${cfg.badgeClass} hover:opacity-80`}
              >
                {cfg.pluralLabel}
              </Link>
            );
          })}
        </div>
      ) : null}

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
          {Object.values(AccountStage).map((stage) => {
            const label = fixedType
              ? (getTypeConfig(fixedType).stageLabels[stage as keyof typeof ACCOUNT_TYPE_CONFIG.CUSTOMER.stageLabels] ?? stage)
              : stage;
            return (
              <option key={stage} value={stage}>
                {label}
              </option>
            );
          })}
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
        headers={
          fixedType
            ? ["Company Name", "Industry", "Status", "Contacts", "Phone", "Website", "State/Region", "Updated"]
            : ["Company Name", "Type", "Industry", "Status", "Contacts", "Phone", "State/Region", "Updated"]
        }
      >
        {accounts.map((account) => (
          <tr key={account.id} className="border-t border-slate-200 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/crm/accounts/${account.id}`} className="hover:underline">
                  {account.companyName}
                </Link>
                <EnrichAccountRowButton accountId={account.id} />
              </div>
            </td>
            {!fixedType ? (
              <td className="px-4 py-3">
                <AccountTypeBadge accountType={account.accountType} />
              </td>
            ) : null}
            <td className="px-4 py-3">{account.industry ?? "—"}</td>
            <td className="px-4 py-3">
              <StageBadge stage={account.stage} accountType={account.accountType} />
            </td>
            <td className="px-4 py-3">{account._count.contacts}</td>
            <td className="px-4 py-3">{account.phone ?? "—"}</td>
            {fixedType ? (
              <td className="px-4 py-3">
                {account.website ? (
                  <a href={account.website} className="text-blue-700 hover:underline" target="_blank" rel="noreferrer">
                    Website
                  </a>
                ) : "—"}
              </td>
            ) : null}
            <td className="px-4 py-3">{[account.state, account.region].filter(Boolean).join(" / ") || "—"}</td>
            <td className="px-4 py-3">{account.updatedAt.toISOString().slice(0, 10)}</td>
          </tr>
        ))}
      </DataTable>
      {accounts.length === 0 && !dbWarning ? (
        <EmptyState
          title={`No ${title.toLowerCase()} found`}
          description="Try adjusting filters or adding a new relationship."
        />
      ) : null}
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}
