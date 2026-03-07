import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/crm/ui/data-table";
import { FilterBar } from "@/components/crm/ui/filter-bar";
import { PageHeader } from "@/components/crm/ui/page-header";
import { SearchInput } from "@/components/crm/ui/search-input";
import { StatusBadge } from "@/components/crm/ui/status-badge";

type TasksPageProps = {
  searchParams?: { view?: "all" | "open" | "today" | "overdue" | "completed"; search?: string };
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const view = searchParams?.view ?? "all";
  const search = searchParams?.search ?? "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  let dbWarning: string | null = null;
  type TaskWithRelations = Prisma.TaskGetPayload<{
    include: { account: true; contact: true };
  }>;
  let tasks: TaskWithRelations[] = [];

  try {
    const where: Prisma.TaskWhereInput =
      view === "open"
        ? { status: "OPEN" }
        : view === "today"
          ? { dueAt: { gte: startToday, lt: endToday }, status: { not: "DONE" } }
          : view === "overdue"
            ? { dueAt: { lt: startToday }, status: { not: "DONE" } }
            : view === "completed"
              ? { status: "DONE" }
              : {};

    tasks = await db.task.findMany({
      where: {
        ...where,
        ...(search
          ? {
              OR: [
                { notes: { contains: search, mode: "insensitive" } },
                { account: { companyName: { contains: search, mode: "insensitive" } } },
                { contact: { fullName: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { account: true, contact: true },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" subtitle="Track follow-up work across accounts and contacts." />

      <FilterBar>
        <select
          name="view"
          defaultValue={view}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        >
          <option value="all">All Tasks</option>
          <option value="open">Open Tasks</option>
          <option value="today">Due Today</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
        </select>
        <SearchInput
          name="search"
          defaultValue={search}
          placeholder="Search notes/account/contact"
          className="md:col-span-3"
        />
        <button type="submit" className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white">
          Apply
        </button>
      </FilterBar>

      <DataTable headers={["Task Type", "Account", "Contact", "Due Date", "Status", "Notes Preview"]}>
        {tasks.map((task) => (
          <tr key={task.id} className="border-t border-slate-200 hover:bg-slate-50">
            <td className="px-4 py-3">{task.type}</td>
            <td className="px-4 py-3">{task.account.companyName}</td>
            <td className="px-4 py-3">{task.contact?.fullName ?? "-"}</td>
            <td className="px-4 py-3">{task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "-"}</td>
            <td className="px-4 py-3">
              <StatusBadge value={task.status} />
            </td>
            <td className="px-4 py-3">{task.notes?.slice(0, 90) ?? "-"}</td>
          </tr>
        ))}
      </DataTable>
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}
