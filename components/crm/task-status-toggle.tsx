"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TaskStatusToggle({ taskId, status }: { taskId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const nextStatus = currentStatus === "DONE" ? "OPEN" : "DONE";
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to update task status.");
      }
      setCurrentStatus(nextStatus);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        className={`whitespace-nowrap rounded-md border px-2 py-1 text-xs disabled:opacity-60 ${
          currentStatus === "DONE"
            ? "border-slate-300 text-slate-600"
            : "border-emerald-300 bg-emerald-50 text-emerald-700"
        }`}
      >
        {currentStatus === "DONE" ? "Reopen" : "Mark Done"}
      </button>
      {error ? <span className="text-[10px] text-rose-600">{error}</span> : null}
    </span>
  );
}
