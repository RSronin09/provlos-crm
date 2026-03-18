import { db } from "@/lib/db";
import { DeliveryStatus, DeliveryPriority, Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/crm/ui/data-table";
import { EmptyState } from "@/components/crm/ui/empty-state";
import { FilterBar } from "@/components/crm/ui/filter-bar";
import { PageHeader } from "@/components/crm/ui/page-header";
import { SearchInput } from "@/components/crm/ui/search-input";
import { DeliveryStatusBadge } from "@/components/crm/ui/delivery-status-badge";
import { PriorityBadge } from "@/components/crm/ui/priority-badge";

type AllDeliveriesPageProps = {
  searchParams?: Promise<{
    status?: string;
    driverId?: string;
    priority?: string;
    search?: string;
  }>;
};

export default async function AllDeliveriesPage({ searchParams }: AllDeliveriesPageProps) {
  const filters = (await searchParams) ?? {};

  const status = Object.values(DeliveryStatus).includes(filters.status as DeliveryStatus)
    ? (filters.status as DeliveryStatus)
    : undefined;
  const priority = Object.values(DeliveryPriority).includes(filters.priority as DeliveryPriority)
    ? (filters.priority as DeliveryPriority)
    : undefined;

  let dbWarning: string | null = null;
  type DeliveryRow = Prisma.DeliveryGetPayload<{
    include: {
      customer: { select: { id: true; companyName: true } };
      assignedDriver: { select: { id: true; name: true } };
    };
  }>;
  let deliveries: DeliveryRow[] = [];
  let drivers: Awaited<ReturnType<typeof db.driver.findMany>> = [];

  try {
    [deliveries, drivers] = await Promise.all([
      db.delivery.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(priority ? { priorityLevel: priority } : {}),
          ...(filters.driverId === "unassigned"
            ? { assignedDriverId: null }
            : filters.driverId
            ? { assignedDriverId: filters.driverId }
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
        },
        orderBy: [{ priorityLevel: "desc" }, { requestedDeliveryDateTime: "asc" }],
        take: 200,
      }),
      db.driver.findMany({ orderBy: { name: "asc" } }),
    ]);
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Deliveries"
        subtitle="Full delivery queue with filters."
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
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={filters.priority ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All priorities</option>
          {Object.values(DeliveryPriority).map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
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
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
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
          "Customer",
          "Pickup Address",
          "Delivery Address",
          "Requested By",
          "Driver",
          "Priority",
          "Status",
          "Created",
        ]}
      >
        {deliveries.map((d) => (
          <tr key={d.id} className="border-t border-slate-200 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium">
              <Link href={`/crm/deliveries/${d.id}`} className="hover:underline">
                {d.customer?.companyName ?? "—"}
              </Link>
            </td>
            <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">{d.pickupAddress}</td>
            <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">{d.deliveryAddress}</td>
            <td className="px-4 py-3 text-slate-600">
              {d.requestedDeliveryDateTime.toISOString().slice(0, 10)}
            </td>
            <td className="px-4 py-3">{d.assignedDriver?.name ?? "—"}</td>
            <td className="px-4 py-3">
              <PriorityBadge priority={d.priorityLevel} />
            </td>
            <td className="px-4 py-3">
              <DeliveryStatusBadge status={d.status} />
            </td>
            <td className="px-4 py-3 text-slate-500">{d.createdAt.toISOString().slice(0, 10)}</td>
          </tr>
        ))}
      </DataTable>

      {deliveries.length === 0 && !dbWarning ? (
        <EmptyState
          title="No deliveries found"
          description="Try adjusting filters or create a new delivery."
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
