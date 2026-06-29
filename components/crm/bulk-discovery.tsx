"use client";

import { useEffect, useState } from "react";

type Candidate = {
  id: string;
  companyName: string;
  website: string | null;
  state: string | null;
  region: string | null;
  signalType: string | null;
  signalSummary: string | null;
  confidenceScore: number | null;
  status: string;
  account: { id: string; companyName: string } | null;
};

const ADMIN_TOKEN_KEY = "crm_admin_token";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  REVIEWED: "bg-amber-100 text-amber-700",
  PROMOTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-slate-100 text-slate-500",
};

const SIGNAL_COLORS: Record<string, string> = {
  hiring: "bg-purple-100 text-purple-700",
  expansion: "bg-indigo-100 text-indigo-700",
  contract: "bg-teal-100 text-teal-700",
  funding: "bg-rose-100 text-rose-700",
  launch: "bg-orange-100 text-orange-700",
  operations: "bg-slate-100 text-slate-600",
};

export function BulkDiscovery() {
  const [adminToken, setAdminToken] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [region, setRegion] = useState("");
  const [statusFilter, setStatusFilter] = useState("NEW");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function handleTokenChange(value: string) {
    setAdminToken(value);
    if (value) localStorage.setItem(ADMIN_TOKEN_KEY, value);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  async function fetchCandidates() {
    setLoadingCandidates(true);
    try {
      const params = new URLSearchParams({ pageSize: "40" });
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/discovery/candidates?${params}`);
      const payload = await response.json();
      setCandidates(payload.data ?? []);
    } catch {
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function authPost(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": adminToken },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Request failed");
    return payload;
  }

  async function authPatch(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Request failed");
    return payload;
  }

  async function enqueueAndProcess() {
    if (!query.trim() || query.trim().length < 2) {
      setMessage({ type: "error", text: "Enter a search query (min 2 characters)." });
      return;
    }
    if (!adminToken) {
      setMessage({ type: "error", text: "Admin token is required." });
      return;
    }
    try {
      setActionLoading(true);
      setMessage({ type: "info", text: "Enqueueing discovery job…" });
      await authPost("/api/discovery/enqueue", {
        query: query.trim(),
        state: state || null,
        region: region || null,
      });
      setMessage({ type: "info", text: "Processing discovery job… this may take a few seconds." });
      const result = await authPost("/api/discovery/process-next");
      const msg = result.message ?? "Discovery job processed.";
      setMessage({ type: "success", text: msg });
      setStatusFilter("NEW");
      await fetchCandidates();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function promoteCandidate(candidateId: string, companyName: string) {
    try {
      setActionLoading(true);
      await authPost(`/api/discovery/candidates/${candidateId}/promote`);
      setMessage({ type: "success", text: `Promoted "${companyName}" to Account.` });
      setCandidates((prev) => prev.map((c) => c.id === candidateId ? { ...c, status: "PROMOTED" } : c));
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectCandidate(candidateId: string, companyName: string) {
    try {
      setActionLoading(true);
      await authPatch(`/api/discovery/candidates/${candidateId}`, { status: "REJECTED" });
      setMessage({ type: "success", text: `Rejected "${companyName}".` });
      setCandidates((prev) => prev.map((c) => c.id === candidateId ? { ...c, status: "REJECTED" } : c));
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setActionLoading(false);
    }
  }

  const messageColors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-rose-50 border-rose-200 text-rose-800",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };

  const filteredCandidates = candidates.filter((c) => !statusFilter || c.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Search form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold text-slate-800">Bulk Company Discovery</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Search the web for companies that match a signal query, then review and promote them to your CRM.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Admin Token</span>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Stored in browser after first entry"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Signal Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="medical courier expansion TX"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="TX"
              maxLength={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Region</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="South"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={enqueueAndProcess}
              disabled={actionLoading || query.trim().length < 2}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              {actionLoading ? "Searching…" : "Find Companies"}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Requires <code className="bg-slate-100 px-1 py-0.5 rounded">SERPER_API_KEY</code> to return live results.
          Without it, no candidates will be generated.
        </p>
      </div>

      {message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageColors[message.type]}`}>
          {message.text}
        </div>
      ) : null}

      {/* Candidate queue */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Candidate Queue</h3>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none"
            >
              <option value="NEW">New</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="PROMOTED">Promoted</option>
              <option value="REJECTED">Rejected</option>
              <option value="">All</option>
            </select>
            <button
              type="button"
              onClick={fetchCandidates}
              disabled={loadingCandidates}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {loadingCandidates ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {loadingCandidates ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Loading candidates…</div>
        ) : filteredCandidates.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-500">No {statusFilter.toLowerCase()} candidates yet.</p>
            <p className="mt-1 text-xs text-slate-400">
              Use the search above to discover companies and populate this queue.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredCandidates.map((candidate) => (
              <li key={candidate.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800">{candidate.companyName}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[candidate.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {candidate.status}
                      </span>
                      {candidate.signalType ? (
                        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${SIGNAL_COLORS[candidate.signalType] ?? "bg-slate-100 text-slate-600"}`}>
                          {candidate.signalType}
                        </span>
                      ) : null}
                      {candidate.confidenceScore !== null ? (
                        <span className="text-xs text-slate-400">
                          {Math.round(candidate.confidenceScore * 100)}% confidence
                        </span>
                      ) : null}
                    </div>
                    {candidate.signalSummary ? (
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{candidate.signalSummary}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                      {candidate.website ? (
                        <a href={candidate.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {candidate.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : null}
                      {candidate.state ? <span>{candidate.state}</span> : null}
                      {candidate.region ? <span>{candidate.region}</span> : null}
                      {candidate.account ? (
                        <a href={`/crm/accounts/${candidate.account.id}`} className="text-emerald-700 hover:underline">
                          In CRM: {candidate.account.companyName}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  {candidate.status === "NEW" || candidate.status === "REVIEWED" ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => promoteCandidate(candidate.id, candidate.companyName)}
                        disabled={actionLoading}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 hover:bg-emerald-500 transition-colors"
                      >
                        Promote
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectCandidate(candidate.id, candidate.companyName)}
                        disabled={actionLoading}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 disabled:opacity-60 hover:bg-slate-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
