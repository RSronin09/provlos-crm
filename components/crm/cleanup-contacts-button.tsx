"use client";

import { useState } from "react";

type DryRunResult = {
  wouldDelete: number;
  samples: { name: string | null; company: string }[];
};

export function CleanupContactsButton() {
  const [busy, setBusy] = useState(false);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(confirm: boolean) {
    const response = await fetch("/api/maintenance/cleanup-contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Request failed");
    return payload;
  }

  async function scan() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await post(false);
      setDryRun(payload.data);
      if (payload.data?.wouldDelete === 0) {
        setMessage("No junk contacts found — nothing to clean up.");
        setDryRun(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const payload = await post(true);
      setMessage(payload.message ?? "Cleanup complete.");
      setDryRun(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={scan}
          disabled={busy}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 hover:bg-slate-50 transition-colors"
        >
          {busy && !dryRun ? "Scanning…" : "Scan for Junk Contacts"}
        </button>

        {dryRun && dryRun.wouldDelete > 0 ? (
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-rose-500 transition-colors"
          >
            {busy ? "Deleting…" : `Delete ${dryRun.wouldDelete} Junk Contact${dryRun.wouldDelete === 1 ? "" : "s"}`}
          </button>
        ) : null}
      </div>

      {dryRun && dryRun.wouldDelete > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-1 font-medium text-slate-700">
            Found {dryRun.wouldDelete} contact(s) whose &quot;name&quot; isn&apos;t a person and that have no
            email, phone, or LinkedIn:
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            {dryRun.samples.map((s, i) => (
              <li key={i}>
                <span className="font-mono">{s.name ?? "(no name)"}</span> — {s.company}
              </li>
            ))}
            {dryRun.wouldDelete > dryRun.samples.length ? (
              <li>…and {dryRun.wouldDelete - dryRun.samples.length} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
    </div>
  );
}
