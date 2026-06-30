"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TaskStatusToggle({ taskId, status }: { taskId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  async function toggle() {
    const nextStatus = currentStatus === "DONE" ? "OPEN" : "DONE";
    setBusy(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Failed");
      setCurrentStatus(nextStatus);
      router.refresh();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
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
  );
}
