import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/crm/ui/data-table";
import { FilterBar } from "@/components/crm/ui/filter-bar";
import { PageHeader } from "@/components/crm/ui/page-header";
import { SearchInput } from "@/components/crm/ui/search-input";
import Link from "next/link";

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

      <DataTable headers={["Task Title", "Account", "Contact", "Due Date", "Status", "Notes Preview"]}>
        {tasks.map((task) => {
          const parsed = parseTaskPayload(task.type, task.notes);
          return (
          <tr key={task.id} className="border-t border-slate-200 hover:bg-slate-50">
            <td className="px-4 py-3">{parsed.title}</td>
            <td className="px-4 py-3">
              <Link href={`/crm/accounts/${task.accountId}#tasks`} className="text-blue-700 hover:underline">
                {task.account.companyName}
              </Link>
            </td>
            <td className="px-4 py-3">{task.contact?.fullName ?? "-"}</td>
            <td className="px-4 py-3">{task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "-"}</td>
            <td className="px-4 py-3">
              <TaskTimelineBadge dueAt={task.dueAt} status={task.status} />
            </td>
            <td className="px-4 py-3">{parsed.body?.slice(0, 90) ?? "-"}</td>
          </tr>
        )})}
      </DataTable>
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}

function TaskTimelineBadge({
  dueAt,
  status,
}: {
  dueAt: Date | null;
  status: "OPEN" | "DONE" | "SNOOZED";
}) {
  if (status === "DONE") {
    return <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">Done</span>;
  }

  if (!dueAt) {
    return <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Open</span>;
  }

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDay = new Date(dueAt.getFullYear(), dueAt.getMonth(), dueAt.getDate());
  const msPerDay = 86_400_000;
  const dayDiff = Math.floor((dueDay.getTime() - startToday.getTime()) / msPerDay);

  if (dayDiff < 0) {
    return <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">Past Due</span>;
  }

  if (dayDiff === 0) {
    return <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">Due</span>;
  }

  if (dayDiff <= 5) {
    return <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">Upcoming</span>;
  }

  return <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Open</span>;
}

function parseTaskPayload(taskType: string, notes: string | null) {
  if (!notes) {
    return { title: taskType, body: null as string | null };
  }

  const [firstLine, ...rest] = notes.split("\n");
  if (firstLine.startsWith("[TITLE] ")) {
    return {
      title: firstLine.replace("[TITLE] ", "").trim() || taskType,
      body: rest.join("\n").trim() || null,
    };
  }

  return {
    title: taskType,
    body: notes,
  };
}
