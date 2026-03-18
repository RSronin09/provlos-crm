import { db } from "@/lib/db";
import { DeliveryStatus, DeliveryPriority, IssueStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/crm/ui/data-table";
import { EmptyState } from "@/components/crm/ui/empty-state";
import { FilterBar } from "@/components/crm/ui/filter-bar";
import { PageHeader } from "@/components/crm/ui/page-header";
import { SearchInput } from "@/components/crm/ui/search-input";
import { DeliveryStatusBadge } from "@/components/crm/ui/delivery-status-badge";
import { PriorityBadge } from "@/components/crm/ui/priority-badge";
import { isOverdue, isAtRisk, TERMINAL_STATUSES } from "@/lib/delivery-queue";

type AllDeliveriesPageProps = {
  searchParams?: Promise<{
    status?: string;
    driverId?: string;
    priority?: string;
    search?: string;
    overdueOnly?: string;
    unassignedOnly?: string;
    hasIssue?: string;
    openOnly?: string;
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
  }>;
};

export default async function AllDeliveriesPage({ searchParams }: AllDeliveriesPageProps) {
  const filters = (await searchParams) ?? {};
  const now = new Date();

  const status = Object.values(DeliveryStatus).includes(filters.status as DeliveryStatus)
    ? (filters.status as DeliveryStatus)
    : undefined;
  const priority = Object.values(DeliveryPriority).includes(filters.priority as DeliveryPriority)
    ? (filters.priority as DeliveryPriority)
    : undefined;

  const overdueOnly = filters.overdueOnly === "true";
  const unassignedOnly = filters.unassignedOnly === "true";
  const hasIssue = filters.hasIssue === "true";
  const openOnly = filters.openOnly === "true";

  let dbWarning: string | null = null;
  type DeliveryRow = Prisma.DeliveryGetPayload<{
    include: {
      customer: { select: { id: true; companyName: true } };
      assignedDriver: { select: { id: true; name: true } };
      issues: { where: { status: "open" }; select: { id: true } };
    };
  }>;
  let deliveries: DeliveryRow[] = [];
  let drivers: Awaited<ReturnType<typeof db.driver.findMany>> = [];
  let accounts: { id: string; companyName: string }[] = [];

  try {
    [deliveries, drivers, accounts] = await Promise.all([
      db.delivery.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(priority ? { priorityLevel: priority } : {}),
          ...(filters.driverId === "unassigned"
            ? { assignedDriverId: null }
            : filters.driverId
            ? { assignedDriverId: filters.driverId }
            : {}),
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(unassignedOnly ? { assignedDriverId: null } : {}),
          ...(openOnly ? { status: { notIn: TERMINAL_STATUSES } } : {}),
          ...(overdueOnly
            ? {
                status: { notIn: TERMINAL_STATUSES },
                requestedDeliveryDateTime: { lt: now },
              }
            : {}),
          ...(hasIssue ? { issues: { some: { status: IssueStatus.open } } } : {}),
          ...(filters.dateFrom || filters.dateTo
            ? {
                requestedDeliveryDateTime: {
                  ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                  ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
                },
              }
            : {}),
          ...(filters.search
            ? {
                OR: [
                  { pickupAddress: { contains: filters.search, mode: "insensitive" } },
                  { deliveryAddress: { contains: filters.search, mode: "insensitive" } },
                  { deliveryContactName: { contains: filters.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          customer: { select: { id: true, companyName: true } },
          assignedDriver: { select: { id: true, name: true } },
          issues: { where: { status: "open" }, select: { id: true } },
        },
        orderBy: [{ priorityLevel: "desc" }, { requestedDeliveryDateTime: "asc" }],
        take: 200,
      }),
      db.driver.findMany({ orderBy: { name: "asc" } }),
      db.account.findMany({ select: { id: true, companyName: true }, orderBy: { companyName: "asc" }, take: 200 }),
    ]);
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  const activeFiltersCount = [
    status, priority, filters.driverId, overdueOnly, unassignedOnly, hasIssue, openOnly, filters.dateFrom, filters.dateTo, filters.customerId, filters.search,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Deliveries"
        subtitle={`${deliveries.length} record${deliveries.length !== 1 ? "s" : ""}${activeFiltersCount > 0 ? ` · ${activeFiltersCount} filter${activeFiltersCount > 1 ? "s" : ""} active` : ""}`}
        actions={
          <Link
            href="/crm/deliveries/create"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            + New Delivery
          </Link>
        }
      />

      <FilterBar>
        <SearchInput
          name="search"
          placeholder="Search address / contact"
          defaultValue={filters.search}
          className="md:col-span-2"
        />
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {Object.values(DeliveryStatus).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={filters.priority ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All priorities</option>
          {Object.values(DeliveryPriority).map((p) => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        <select
          name="driverId"
          defaultValue={filters.driverId ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All drivers</option>
          <option value="unassigned">Unassigned</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          name="customerId"
          defaultValue={filters.customerId ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All customers</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.companyName}</option>
          ))}
        </select>
        <div className="flex gap-2 md:col-span-2">
          <input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom ?? ""}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="From"
          />
          <input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo ?? ""}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="To"
          />
        </div>
        <div className="flex flex-wrap gap-3 items-center md:col-span-2">
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" name="overdueOnly" value="true" defaultChecked={overdueOnly}
              className="rounded border-slate-300" />
            Overdue only
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" name="unassignedOnly" value="true" defaultChecked={unassignedOnly}
              className="rounded border-slate-300" />
            Unassigned only
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" name="hasIssue" value="true" defaultChecked={hasIssue}
              className="rounded border-slate-300" />
            Has open issue
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" name="openOnly" value="true" defaultChecked={openOnly}
              className="rounded border-slate-300" />
            Open only
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit"
            className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white">
            Apply
          </button>
          <a href="/crm/deliveries/all"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Clear
          </a>
        </div>
      </FilterBar>

      <DataTable
        headers={["Customer", "Pickup", "Delivery", "Requested By", "Driver", "Priority", "Status", "Created", ""]}
      >
        {deliveries.map((d) => {
          const overdue = isOverdue(d);
          const atRisk = isAtRisk(d, 2);
          const hasOpenIssue = d.issues.length > 0;

          return (
            <tr
              key={d.id}
              className={`border-t border-slate-200 hover:bg-slate-50 ${
                overdue ? "bg-rose-50" : atRisk ? "bg-amber-50" : ""
              }`}
            >
              <td className="px-4 py-3 font-medium">
                <Link href={`/crm/deliveries/${d.id}`} className="hover:underline">
                  {d.customer?.companyName ?? "—"}
                </Link>
              </td>
              <td className="max-w-[140px] truncate px-4 py-3 text-slate-600 text-xs">{d.pickupAddress}</td>
              <td className="max-w-[140px] truncate px-4 py-3 text-slate-600 text-xs">{d.deliveryAddress}</td>
              <td className="px-4 py-3 text-sm">
                <span className={overdue ? "font-semibold text-rose-600" : atRisk ? "font-semibold text-amber-600" : "text-slate-600"}>
                  {d.requestedDeliveryDateTime.toISOString().slice(0, 10)}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                {d.assignedDriver?.name ?? (
                  <span className="text-xs font-medium text-rose-500">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={d.priorityLevel} />
              </td>
              <td className="px-4 py-3">
                <DeliveryStatusBadge status={d.status} />
              </td>
              <td className="px-4 py-3 text-xs text-slate-400">{d.createdAt.toISOString().slice(0, 10)}</td>
              <td className="px-4 py-3 text-right">
                {hasOpenIssue ? (
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                    ISSUE
                  </span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </DataTable>

      {deliveries.length === 0 && !dbWarning ? (
        <EmptyState title="No deliveries found" description="Try adjusting filters or create a new delivery." />
      ) : null}

      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}
