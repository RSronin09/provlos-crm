import { EmptyState } from "./empty-state";
import { StatusBadge } from "./status-badge";

type TaskRow = {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
};

type TaskListCardProps = {
  title: string;
  tasks: TaskRow[];
};

export function TaskListCard({ title, tasks }: TaskListCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      {!tasks.length ? (
        <EmptyState title="No tasks" description="Create follow-ups and outreach reminders here." />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-md border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{task.title}</p>
                <StatusBadge value={task.status} />
              </div>
              {task.subtitle ? <p className="mt-1 text-sm text-slate-600">{task.subtitle}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
