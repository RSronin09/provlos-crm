"use client";

import { useAdminToken } from "@/lib/use-admin-token";
import { useState } from "react";
import {
  FLORIDA_COUNTY_CITIES,
  HEALTHCARE_FACILITY_KEYWORDS,
  HEALTHCARE_FACILITY_TITLES,
  INSTANTLY_EMPLOYEE_COUNT_BRACKETS,
} from "@/lib/instantly-constants";

const COUNTY_OPTIONS = Object.keys(FLORIDA_COUNTY_CITIES);

type Message = { type: "success" | "error" | "info"; text: string } | null;

export function InstantlySearchPanel() {
  const [adminToken, handleTokenChange] = useAdminToken();
  const [counties, setCounties] = useState<string[]>(COUNTY_OPTIONS);
  const [keywords, setKeywords] = useState(HEALTHCARE_FACILITY_KEYWORDS.join(", "));
  const [titles, setTitles] = useState(HEALTHCARE_FACILITY_TITLES.join(", "));
  const [employeeCount, setEmployeeCount] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);
  const [listId, setListId] = useState("");
  const [resourceId, setResourceId] = useState<string | null>(null);

  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<"count" | "search" | "import" | null>(null);
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
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
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
    if (!adminToken) {
      setMessage({ type: "error", text: "Admin token is required." });
      return;
    }
    try {
      setBusy("count");
      setMessage({ type: "info", text: "Checking how many leads match…" });
      const payload = await authPost("/api/discovery/instantly/count", buildRequestBody());
      setMatchCount(payload.data?.count ?? 0);
      setMessage({ type: "success", text: `${payload.data?.count ?? 0} leads match this search.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  async function startEnrichment() {
    if (!adminToken) {
      setMessage({ type: "error", text: "Admin token is required." });
      return;
    }
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
    if (!adminToken) {
      setMessage({ type: "error", text: "Admin token is required." });
      return;
    }
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
            placeholder="Stored in browser after first entry"
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

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm block">
            <span className="mb-1 block font-medium text-slate-700">Facility keywords (comma-separated)</span>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </label>
          <label className="text-sm block">
            <span className="mb-1 block font-medium text-slate-700">Target job titles (comma-separated)</span>
            <textarea
              value={titles}
              onChange={(e) => setTitles(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </label>
        </div>

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
            onClick={startEnrichment}
            disabled={busy !== null}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800 transition-colors"
          >
            {busy === "search" ? "Starting…" : "2. Start Search & Enrich"}
          </button>

          {matchCount !== null ? (
            <span className="text-sm text-slate-500">~{matchCount} leads match</span>
          ) : null}
        </div>

        <p className="text-xs text-slate-400">
          Requires <code className="bg-slate-100 px-1 py-0.5 rounded">INSTANTLY_API_KEY</code> to be set on the
          server, plus an active paid Instantly workspace plan. Step 1 is free; step 2 spends Instantly credits.
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
