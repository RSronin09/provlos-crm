"use client";

import { useEffect, useState } from "react";
import {
  FLORIDA_COUNTY_CITIES,
  HEALTHCARE_FACILITY_KEYWORDS,
  HEALTHCARE_FACILITY_TITLES,
  INSTANTLY_EMPLOYEE_COUNT_BRACKETS,
} from "@/lib/instantly-constants";

const ADMIN_TOKEN_KEY = "crm_admin_token";

const COUNTY_OPTIONS = Object.keys(FLORIDA_COUNTY_CITIES);

type CustomLocation = { city: string; state: string };

type Message = { type: "success" | "error" | "info"; text: string } | null;

export function InstantlySearchPanel() {
  const [adminToken, setAdminToken] = useState("");
  const [counties, setCounties] = useState<string[]>(["Lee County, FL", "Sarasota County, FL"]);
  const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
  const [customCity, setCustomCity] = useState("");
  const [customState, setCustomState] = useState("");
  const [keyword, setKeyword] = useState("");
  const [titles, setTitles] = useState(HEALTHCARE_FACILITY_TITLES.join(", "));
  const [employeeCount, setEmployeeCount] = useState<string[]>([]);
  const [locationMode, setLocationMode] = useState<"contact" | "company">("contact");
  const [useSubIndustry, setUseSubIndustry] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [limit, setLimit] = useState(50);
  const [listId, setListId] = useState("");
  const [resourceId, setResourceId] = useState<string | null>(null);

  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [lastFilters, setLastFilters] = useState<unknown>(null);
  const [busy, setBusy] = useState<"count" | "search" | "import" | null>(null);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (stored) setAdminToken(stored);
  }, []);

  function handleTokenChange(value: string) {
    setAdminToken(value);
    if (value) localStorage.setItem(ADMIN_TOKEN_KEY, value);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  function toggleCounty(county: string) {
    setCounties((prev) => (prev.includes(county) ? prev.filter((c) => c !== county) : [...prev, county]));
  }

  function toggleEmployeeCount(bracket: string) {
    setEmployeeCount((prev) => (prev.includes(bracket) ? prev.filter((b) => b !== bracket) : [...prev, bracket]));
  }

  function addCustomLocation() {
    if (!customCity.trim() && !customState.trim()) return;
    setCustomLocations((prev) => [...prev, { city: customCity.trim(), state: customState.trim() }]);
    setCustomCity("");
    setCustomState("");
  }

  function removeCustomLocation(index: number) {
    setCustomLocations((prev) => prev.filter((_, i) => i !== index));
  }

  function buildRequestBody() {
    return {
      counties,
      customLocations: customLocations.length ? customLocations : undefined,
      // Deliberately a single string, not an array — see lib/instantly.ts
      // buildHealthcareCountySearchFilters for why joining multiple terms
      // with "OR" silently returns zero matches.
      keyword: keyword.trim() || undefined,
      titles: titles.split(",").map((t) => t.trim()).filter(Boolean),
      employeeCount: employeeCount.length ? employeeCount : undefined,
      locationMode,
      useSubIndustry,
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
      setLastFilters(payload.data?.filters ?? null);
      const count = payload.data?.count ?? 0;
      setMessage(
        count === 0
          ? {
              type: "info",
              text:
                "0 leads match — try unchecking \"Narrow by health sub-category\" below, removing the keyword " +
                "phrase, or widening the counties/cities. Expand \"Filters sent to Instantly\" to see exactly what was searched.",
            }
          : { type: "success", text: `${count} leads match this search.` },
      );
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
      setLastFilters(payload.data?.filters ?? null);
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
            pull matching leads straight into the CRM. Pre-configured for healthcare/senior-living facilities —
            add any county/city below, it&apos;s not limited to the two presets.
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
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Counties (presets — check any combination)
          </span>
          <div className="flex flex-wrap gap-3">
            {COUNTY_OPTIONS.map((county) => (
              <label key={county} className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" checked={counties.includes(county)} onChange={() => toggleCounty(county)} />
                {county}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Expands each county into its major cities for the location filter (no Google Places key required). Don&apos;t
            see a county you need? Add any city/county below instead.
          </p>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Add a custom city/county</span>
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="text"
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder="City (e.g. Naples)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <input
              type="text"
              value={customState}
              onChange={(e) => setCustomState(e.target.value)}
              placeholder="State (e.g. Florida)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <button
              type="button"
              onClick={addCustomLocation}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
            >
              + Add location
            </button>
          </div>
          {customLocations.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {customLocations.map((loc, i) => (
                <span
                  key={`${loc.city}-${loc.state}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                >
                  {[loc.city, loc.state].filter(Boolean).join(", ")}
                  <button type="button" onClick={() => removeCustomLocation(i)} className="text-slate-400 hover:text-slate-700">
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <label className="text-sm block">
          <span className="mb-1 block font-medium text-slate-700">Keyword phrase (optional)</span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={`e.g. "${HEALTHCARE_FACILITY_KEYWORDS[0]}" — one phrase only, matched literally`}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <p className="mt-1 text-xs text-slate-400">
            Instantly matches this as one literal phrase — it does not support combining multiple terms with
            &quot;OR&quot;. Leave blank to rely on industry + job title targeting instead (usually the better default).
            Ideas: {HEALTHCARE_FACILITY_KEYWORDS.join(", ")}.
          </p>
        </label>

        <label className="text-sm block">
          <span className="mb-1 block font-medium text-slate-700">Target job titles (comma-separated)</span>
          <textarea
            value={titles}
            onChange={(e) => setTitles(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </label>

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

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            {showAdvanced ? "Hide" : "Show"} advanced options (useful if matches are stuck at zero)
          </button>
          {showAdvanced ? (
            <div className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={useSubIndustry}
                  onChange={(e) => setUseSubIndustry(e.target.checked)}
                />
                Narrow by health sub-category (Hospital &amp; Health Care, Medical Practice, etc.)
              </label>
              <p className="text-xs text-slate-400 -mt-2">
                Uncheck this first if a search returns 0 — many smaller facilities aren&apos;t tagged with a
                sub-category at all, so this filter can be too strict.
              </p>
              <label className="text-sm block">
                <span className="mb-1 block font-medium text-slate-700">Location match mode</span>
                <select
                  value={locationMode}
                  onChange={(e) => setLocationMode(e.target.value as "contact" | "company")}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="contact">Contact&apos;s own location (default, usually better coverage)</option>
                  <option value="company">Company HQ location</option>
                </select>
              </label>
            </div>
          ) : null}
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

        {lastFilters ? (
          <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-600">
              Filters sent to Instantly (for debugging)
            </summary>
            <pre className="mt-2 overflow-x-auto text-xs text-slate-600">{JSON.stringify(lastFilters, null, 2)}</pre>
          </details>
        ) : null}

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
