"use client";

import { useState } from "react";

type CandidateRow = {
  id: string;
  status: string;
  companyName: string;
};

type DiscoveryActionsProps = {
  candidates: CandidateRow[];
};

export function DiscoveryActions({ candidates }: DiscoveryActionsProps) {
  const [adminToken, setAdminToken] = useState("");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [state, setState] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function post(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": adminToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "Request failed");
    }

    return response.json();
  }

  async function patch(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "Request failed");
    }

    return response.json();
  }

  async function enqueueDiscovery() {
    try {
      setLoading(true);
      await post("/api/discovery/enqueue", {
        query,
        region: region || null,
        state: state || null,
      });
      setStatus("Discovery job enqueued.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function processNext() {
    try {
      setLoading(true);
      const result = await post("/api/discovery/process-next");
      setStatus(result.message ?? "Processed one discovery job.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function promoteCandidate(candidateId: string, companyName: string) {
    try {
      setLoading(true);
      await post(`/api/discovery/candidates/${candidateId}/promote`);
      setStatus(`Promoted ${companyName} to Account.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function rejectCandidate(candidateId: string, companyName: string) {
    try {
      setLoading(true);
      await patch(`/api/discovery/candidates/${candidateId}`, { status: "REJECTED" });
      setStatus(`Rejected ${companyName}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <label className="block text-sm font-medium text-slate-700">
        Admin Token (required for discovery actions)
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-2 md:grid-cols-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search query (e.g. medical courier expansion)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
        <input
          type="text"
          value={state}
          onChange={(event) => setState(event.target.value)}
          placeholder="State"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          placeholder="Region"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={enqueueDiscovery}
          disabled={loading || query.trim().length < 2}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Enqueue Discovery
        </button>
        <button
          type="button"
          onClick={processNext}
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          Process Next Job
        </button>
      </div>

      <div className="space-y-2">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{candidate.companyName}</span>
              <span className="ml-2 text-slate-600">({candidate.status})</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => promoteCandidate(candidate.id, candidate.companyName)}
                disabled={loading || candidate.status === "PROMOTED" || candidate.status === "REJECTED"}
                className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-60"
              >
                Promote
              </button>
              <button
                type="button"
                onClick={() => rejectCandidate(candidate.id, candidate.companyName)}
                disabled={loading || candidate.status === "PROMOTED" || candidate.status === "REJECTED"}
                className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </div>
  );
}
