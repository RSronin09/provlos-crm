import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export default async function TasksPage() {
  let dbWarning: string | null = null;
  type TaskWithRelations = Prisma.TaskGetPayload<{
    include: { account: true; contact: true };
  }>;
  let tasks: TaskWithRelations[] = [];

  try {
    tasks = await db.task.findMany({
      include: { account: true, contact: true },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Tasks</h2>
        <p className="text-sm text-slate-600">Open follow-ups and research tasks.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-slate-200">
                <td className="px-4 py-3">{task.status}</td>
                <td className="px-4 py-3">{task.type}</td>
                <td className="px-4 py-3">{task.account.companyName}</td>
                <td className="px-4 py-3">{task.contact?.fullName ?? "-"}</td>
                <td className="px-4 py-3">{task.dueAt ? task.dueAt.toISOString().slice(0, 10) : "-"}</td>
                <td className="px-4 py-3">{task.notes ?? "-"}</td>
              </tr>
            ))}
            {tasks.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                  No tasks available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}
