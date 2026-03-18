"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeliveryNotesPanelProps = {
  deliveryId: string;
  initialNotes: string | null;
};

export function DeliveryNotesPanel({ deliveryId, initialNotes }: DeliveryNotesPanelProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatcherNotes: notes }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error ?? "Failed to save notes.");
      }
      setStatus("Notes saved.");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error saving notes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Add internal dispatcher notes here — not visible to driver or customer..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center justify-between">
        {status ? (
          <p className={`text-xs ${status.includes("Error") || status.includes("Failed") ? "text-rose-600" : "text-emerald-600"}`}>
            {status}
          </p>
        ) : (
          <span />
        )}
        <button
          onClick={handleSave}
          disabled={busy}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save Notes"}
        </button>
      </div>
    </div>
  );
}
