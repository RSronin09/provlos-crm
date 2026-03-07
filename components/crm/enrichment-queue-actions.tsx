"use client";

import { useState } from "react";

export function EnrichmentQueueActions() {
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);

  async function enqueue() {
    try {
      setLoading(true);
      const response = await fetch("/api/enrichment/enqueue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify(accountId ? { accountId } : { filters: { enrichmentStatus: "NOT_STARTED" } }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to enqueue");
      setStatus("Enrichment jobs queued.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function processNext() {
    try {
      setLoading(true);
      const response = await fetch("/api/enrichment/process-next", {
        method: "POST",
        headers: { "x-admin-token": adminToken },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to process job");
      setStatus(payload.message ?? "Processed one job.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="Admin token"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          placeholder="Optional account id"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={enqueue}
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          Enqueue Account
        </button>
        <button
          type="button"
          onClick={processNext}
          disabled={loading}
          className="rounded-md bg-blue-700 px-3 py-2 text-sm text-white"
        >
          Process Next Job
        </button>
      </div>
      {status ? <p className="mt-2 text-sm text-slate-700">{status}</p> : null}
    </div>
  );
}
