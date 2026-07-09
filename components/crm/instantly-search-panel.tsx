"use client";

import { useAdminToken } from "@/lib/use-admin-token";
import { useState } from "react";
import {
  FLORIDA_COUNTY_CITIES,
  HEALTHCARE_FACILITY_TITLES,
  INSTANTLY_EMPLOYEE_COUNT_BRACKETS,
} from "@/lib/instantly-constants";

const COUNTY_OPTIONS = Object.keys(FLORIDA_COUNTY_CITIES);

type Message = { type: "success" | "error" | "info"; text: string } | null;

type PreviewLead = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  companyName?: string;
  location?: string;
};

type DiagnosisStep = {
  key: string;
  label: string;
  count: number | null;
  error?: string;
};

export function InstantlySearchPanel() {
  const [adminToken, handleTokenChange] = useAdminToken();
  const [counties, setCounties] = useState<string[]>(COUNTY_OPTIONS);
  const [keywordInclude, setKeywordInclude] = useState("");
  const [keywordExclude, setKeywordExclude] = useState("");
  const [titles, setTitles] = useState(HEALTHCARE_FACILITY_TITLES.join(", "));
  const [employeeCount, setEmployeeCount] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);
  const [listId, setListId] = useState("");
  const [resourceId, setResourceId] = useState<string | null>(null);

  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [previewLeads, setPreviewLeads] = useState<PreviewLead[] | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisStep[] | null>(null);
  const [busy, setBusy] = useState<"count" | "preview" | "search" | "import" | "diagnose" | null>(null);
  const [message, setMessage] = useState<Message>(null);

  function toggleCounty(county: string) {
    setCounties((prev) => (prev.includes(county) ? prev.filter((c) => c !== county) : [...prev, county]));
  }

  function toggleEmployeeCount(bracket: string) {
    setEmployeeCount((prev) => (prev.includes(bracket) ? prev.filter((b) => b !== bracket) : [...prev, bracket]));
  }

  function buildRequestBody() {
    return {
      counties,
      keywordInclude: keywordInclude.trim() || undefined,
      keywordExclude: keywordExclude.trim() || undefined,
      titles: titles.split(",").map((t) => t.trim()).filter(Boolean),
      employeeCount: employeeCount.length ? employeeCount : undefined,
    };
  }

  async function authPost(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Request failed");
    return payload;
  }

  async function checkCount() {
    try {
      setBusy("count");
      setMessage({ type: "info", text: "Checking how many leads match…" });
      const payload = await authPost("/api/discovery/instantly/count", buildRequestBody());
      const count = payload.data?.count ?? 0;
      setMatchCount(count);
      if (count === 0) {
        setMessage({
          type: "info",
          text:
            "0 leads match. Filters are combined with AND — try clearing the keyword filter, removing some job titles, or selecting more counties, then re-check.",
        });
      } else {
        setMessage({ type: "success", text: `${count} leads match this search.` });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  async function diagnoseZeroMatches() {
    try {
      setBusy("diagnose");
      setMessage({ type: "info", text: "Re-running the count with fewer filters to find the culprit…" });
      const payload = await authPost("/api/discovery/instantly/diagnose", buildRequestBody());
      const steps: DiagnosisStep[] = payload.data?.steps ?? [];
      setDiagnosis(steps);
      const firstHit = steps.find((s) => (s.count ?? 0) > 0);
      setMessage(
        firstHit
          ? { type: "success", text: `Diagnosis complete — matches appear at: "${firstHit.label}".` }
          : {
              type: "error",
              text:
                "Even the broadest variant returned 0. That points to the API key, workspace plan, or the location/industry filters rather than your keyword or title.",
            },
      );
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  async function previewMatches() {
    try {
      setBusy("preview");
      setMessage({ type: "info", text: "Fetching a free sample of matching leads…" });
      const payload = await authPost("/api/discovery/instantly/preview", buildRequestBody());
      const leads: PreviewLead[] = payload.data?.leads ?? [];
      setPreviewLeads(leads);
      setMatchCount(payload.data?.totalCount ?? leads.length);
      setMessage(
        leads.length
          ? { type: "success", text: `Showing ${leads.length} sample leads (${payload.data?.totalCount ?? "?"} total match).` }
          : {
              type: "info",
              text:
                "No sample leads returned. Filters are combined with AND — try clearing the keyword filter or removing some job titles.",
            },
      );
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  async function startEnrichment() {
    try {
      setBusy("search");
      setMessage({ type: "info", text: "Starting enrichment in Instantly…" });
      const payload = await authPost("/api/discovery/instantly/search", { ...buildRequestBody(), limit });
      setResourceId(payload.data?.resourceId ?? null);
      if (payload.data?.resourceId) setListId(payload.data.resourceId);
      setMessage({ type: "success", text: payload.message ?? "Enrichment started." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  async function importResults() {
    if (!listId.trim()) {
      setMessage({ type: "error", text: "Enter the list/resource ID from the enrichment step above." });
      return;
    }
    try {
      setBusy("import");
      setMessage({ type: "info", text: "Importing leads into the CRM…" });
      const payload = await authPost("/api/discovery/instantly/import", { listId: listId.trim() });
      setMessage({ type: "success", text: payload.message ?? "Import complete." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  const messageColors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-rose-50 border-rose-200 text-rose-800",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold text-slate-800">Instantly Lead Finder</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Search Instantly&apos;s 450M+ verified B2B contact database by industry, job title, and location, then
            pull matching leads straight into the CRM. Pre-configured for healthcare/senior-living facilities in Lee
            &amp; Sarasota County, FL — adjust any field below for other searches.
          </p>
        </div>

        <label className="text-sm block">
          <span className="mb-1 block font-medium text-slate-700">Admin Token</span>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => handleTokenChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            placeholder="Only needed if ADMIN_TOKEN is set on the server"
          />
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Counties</span>
          <div className="flex flex-wrap gap-3">
            {COUNTY_OPTIONS.map((county) => (
              <label key={county} className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" checked={counties.includes(county)} onChange={() => toggleCounty(county)} />
                {county}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Expands each county into its major cities for the location filter (no Google Places key required).
          </p>
        </div>

        <label className="text-sm block">
          <span className="mb-1 block font-medium text-slate-700">Target job titles (comma-separated)</span>
          <textarea
            value={titles}
            onChange={(e) => setTitles(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm block">
            <span className="mb-1 block font-medium text-slate-700">Keyword filter — include (optional)</span>
            <input
              type="text"
              value={keywordInclude}
              onChange={(e) => setKeywordInclude(e.target.value)}
              placeholder='e.g. "assisted living" — leave empty for broadest results'
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </label>
          <label className="text-sm block">
            <span className="mb-1 block font-medium text-slate-700">Keyword filter — exclude (optional)</span>
            <input
              type="text"
              value={keywordExclude}
              onChange={(e) => setKeywordExclude(e.target.value)}
              placeholder="e.g. staffing"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </label>
        </div>
        <p className="-mt-2 text-xs text-slate-400">
          Instantly matches the keyword as one literal phrase and ANDs it with every other filter, so keep it to a
          single term (or empty). The industry + sub-industry filters already restrict results to healthcare
          facilities.
        </p>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Employee count (optional)</span>
          <div className="flex flex-wrap gap-3">
            {INSTANTLY_EMPLOYEE_COUNT_BRACKETS.map((bracket) => (
              <label key={bracket} className="flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={employeeCount.includes(bracket)}
                  onChange={() => toggleEmployeeCount(bracket)}
                />
                {bracket}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Max leads to enrich</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 50)}
              className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </label>

          <button
            type="button"
            onClick={checkCount}
            disabled={busy !== null}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 hover:bg-slate-50 transition-colors"
          >
            {busy === "count" ? "Checking…" : "1. Check Match Count"}
          </button>

          <button
            type="button"
            onClick={previewMatches}
            disabled={busy !== null}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 hover:bg-slate-50 transition-colors"
          >
            {busy === "preview" ? "Loading…" : "2. Preview Sample (free)"}
          </button>

          <button
            type="button"
            onClick={startEnrichment}
            disabled={busy !== null}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800 transition-colors"
          >
            {busy === "search" ? "Starting…" : "3. Start Search & Enrich"}
          </button>

          {matchCount !== null ? (
            <span className="text-sm text-slate-500">~{matchCount} leads match</span>
          ) : null}

          {matchCount === 0 ? (
            <button
              type="button"
              onClick={diagnoseZeroMatches}
              disabled={busy !== null}
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-60 hover:bg-amber-100 transition-colors"
            >
              {busy === "diagnose" ? "Diagnosing…" : "Diagnose 0 matches (free)"}
            </button>
          ) : null}
        </div>

        {diagnosis ? (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Diagnosis — each row removes one more filter
            </div>
            <ul className="divide-y divide-slate-100 text-sm">
              {diagnosis.map((step) => (
                <li key={step.key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-slate-700">{step.label}</span>
                  {step.error ? (
                    <span className="shrink-0 text-xs text-rose-600" title={step.error}>error</span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        (step.count ?? 0) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
                      }`}
                    >
                      {step.count ?? "—"} leads
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              The first row with a non-zero count tells you which removed filter was eliminating everything —
              loosen that one in the form above and re-check.
            </p>
          </div>
        ) : null}

        {previewLeads && previewLeads.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewLeads.map((lead, i) => (
                  <tr key={i} className="text-slate-700">
                    <td className="px-3 py-2">
                      {lead.fullName ?? [lead.firstName, lead.lastName].filter(Boolean).join(" ") ?? "—"}
                    </td>
                    <td className="px-3 py-2">{lead.jobTitle ?? "—"}</td>
                    <td className="px-3 py-2">{lead.companyName ?? "—"}</td>
                    <td className="px-3 py-2">{lead.location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="text-xs text-slate-400">
          Requires <code className="bg-slate-100 px-1 py-0.5 rounded">INSTANTLY_API_KEY</code> to be set on the
          server, plus an active paid Instantly workspace plan. Steps 1 and 2 are free; step 3 spends Instantly
          credits.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-800">3. Import Results</h3>
        <p className="text-sm text-slate-500">
          Enrichment runs in the background on Instantly&apos;s side and can take a few minutes. Once it&apos;s done,
          paste the resulting list/resource ID below (auto-filled after step 2) and import the verified contacts
          straight into Accounts &amp; Contacts.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm flex-1 min-w-[240px]">
            <span className="mb-1 block font-medium text-slate-700">List / Resource ID</span>
            <input
              type="text"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              placeholder={resourceId ?? "01234567-89ab-cdef-0123-456789abcdef"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </label>
          <button
            type="button"
            onClick={importResults}
            disabled={busy !== null}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-emerald-500 transition-colors"
          >
            {busy === "import" ? "Importing…" : "Import to CRM"}
          </button>
        </div>
      </div>

      {message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageColors[message.type]}`}>{message.text}</div>
      ) : null}
    </div>
  );
}
