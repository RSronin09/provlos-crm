"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/crm/ui/empty-state";
import { StatusBadge } from "@/components/crm/ui/status-badge";

type TaskRow = {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
};

export function ContactTaskList({ title, tasks: initialTasks }: { title: string; tasks: TaskRow[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleStatus(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === "DONE" ? "OPEN" : "DONE";
    setBusyId(taskId);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to update task.");
      }
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      {error ? (
        <p className="mb-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
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
              <button
                type="button"
                disabled={busyId === task.id}
                onClick={() => toggleStatus(task.id, task.status)}
                className={`mt-2 rounded-md border px-2 py-1 text-xs disabled:opacity-60 ${
                  task.status === "DONE"
                    ? "border-slate-300 text-slate-600"
                    : "border-emerald-300 bg-emerald-50 text-emerald-700"
                }`}
              >
                {task.status === "DONE" ? "Reopen" : "Mark Done"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
