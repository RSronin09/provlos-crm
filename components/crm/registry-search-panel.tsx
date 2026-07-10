"use client";

import { FLORIDA_COUNTY_CITIES } from "@/lib/instantly-constants";
import { useAdminToken } from "@/lib/use-admin-token";
import { useMemo, useState } from "react";

const COUNTY_OPTIONS = Object.keys(FLORIDA_COUNTY_CITIES);

// Mirrors FACILITY_TYPE_PRESETS in lib/npi.ts (kept as a plain list here so
// this client component doesn't import server code).
const FACILITY_TYPES: { key: string; label: string; defaultSelected: boolean }[] = [
  { key: "dialysis", label: "Dialysis (ESRD)", defaultSelected: true },
  { key: "snf", label: "Skilled Nursing", defaultSelected: true },
  { key: "alf", label: "Assisted Living", defaultSelected: true },
  { key: "hospital", label: "Hospital", defaultSelected: true },
  { key: "rehab", label: "Rehabilitation", defaultSelected: true },
  { key: "adult_day", label: "Adult Day Care", defaultSelected: true },
  { key: "oncology", label: "Oncology Clinic", defaultSelected: false },
  { key: "pt", label: "Physical Therapy", defaultSelected: false },
  { key: "home_health", label: "Home Health", defaultSelected: false },
  { key: "hospice", label: "Hospice", defaultSelected: false },
];

type Facility = {
  npi: string;
  organizationName: string;
  facilityType: string;
  address1: string | null;
  city: string | null;
  phone: string | null;
  county: string | null;
  existingAccountId: string | null;
  authorizedOfficial: {
    fullName: string;
    title: string | null;
    phone: string | null;
  } | null;
};

type Message = { type: "success" | "error" | "info"; text: string } | null;

export function RegistrySearchPanel() {
  const [adminToken, handleTokenChange] = useAdminToken();
  const [counties, setCounties] = useState<string[]>(COUNTY_OPTIONS);
  const [extraCities, setExtraCities] = useState("");
  const [facilityTypes, setFacilityTypes] = useState<string[]>(
    FACILITY_TYPES.filter((t) => t.defaultSelected).map((t) => t.key),
  );
  const [enrichEmails, setEnrichEmails] = useState(false);

  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"search" | "import" | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const newFacilities = useMemo(
    () => (facilities ?? []).filter((f) => !f.existingAccountId),
    [facilities],
  );

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function buildRequestBody() {
    return {
      counties,
      cities: extraCities.split(",").map((c) => c.trim()).filter(Boolean),
      state: "FL",
      facilityTypes,
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

  async function search() {
    if (!facilityTypes.length) {
      setMessage({ type: "error", text: "Select at least one facility type." });
      return;
    }
    try {
      setBusy("search");
      setMessage({ type: "info", text: "Querying the NPI registry (free, no credits)…" });
      const payload = await authPost("/api/discovery/registry/search", buildRequestBody());
      const found: Facility[] = payload.data?.facilities ?? [];
      setFacilities(found);
      setSelected(new Set(found.filter((f) => !f.existingAccountId).map((f) => f.npi)));
      setMessage({
        type: found.length ? "success" : "info",
        text: found.length
          ? `Found ${found.length} licensed facilities (${payload.data?.alreadyInCrm ?? 0} already in CRM).`
          : "No facilities found — try more counties or facility types.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  async function importSelected() {
    const npis = [...selected];
    if (!npis.length) {
      setMessage({ type: "error", text: "Select at least one facility to import." });
      return;
    }
    try {
      setBusy("import");
      setMessage({ type: "info", text: `Importing ${npis.length} facilities…` });
      const payload = await authPost("/api/discovery/registry/import", {
        ...buildRequestBody(),
        npis,
        enrichEmails,
      });
      setMessage({ type: "success", text: payload.message ?? "Import complete." });
      // Refresh the "already in CRM" flags
      await search();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  function toggleSelected(npi: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(npi)) next.delete(npi);
      else next.add(npi);
      return next;
    });
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
          <h3 className="font-semibold text-slate-800">Healthcare Facility Registry</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Pulls every licensed healthcare facility whose patients need non-emergency medical transport —
            dialysis centers, nursing homes, assisted living, hospitals, rehab — straight from the U.S.
            government&apos;s NPI registry. Free, no API key, no credits. Each facility comes with its authorized
            official (decision-maker name, title, and phone). Optionally look up their email via your enrichment
            providers.
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
                <input
                  type="checkbox"
                  checked={counties.includes(county)}
                  onChange={() => toggle(counties, county, setCounties)}
                />
                {county}
              </label>
            ))}
          </div>
        </div>

        <label className="text-sm block">
          <span className="mb-1 block font-medium text-slate-700">Additional cities (comma-separated, optional)</span>
          <input
            type="text"
            value={extraCities}
            onChange={(e) => setExtraCities(e.target.value)}
            placeholder="e.g. Naples, Punta Gorda"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Facility types</span>
          <div className="flex flex-wrap gap-3">
            {FACILITY_TYPES.map((type) => (
              <label key={type.key} className="flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={facilityTypes.includes(type.key)}
                  onChange={() => toggle(facilityTypes, type.key, setFacilityTypes)}
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={search}
            disabled={busy !== null}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800 transition-colors"
          >
            {busy === "search" ? "Searching…" : "Search Registry (free)"}
          </button>

          {facilities !== null ? (
            <>
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={enrichEmails}
                  onChange={(e) => setEnrichEmails(e.target.checked)}
                />
                Also look up emails (uses Apollo/PDL, capped at 15 per import)
              </label>
              <button
                type="button"
                onClick={importSelected}
                disabled={busy !== null || selected.size === 0}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-emerald-500 transition-colors"
              >
                {busy === "import" ? "Importing…" : `Import ${selected.size} Selected to CRM`}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageColors[message.type]}`}>{message.text}</div>
      ) : null}

      {facilities && facilities.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">
              {facilities.length} facilities — {newFacilities.length} new
            </p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelected(new Set(newFacilities.map((f) => f.npi)))}
                className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
              >
                Select all new
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2">Facility</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Decision Maker</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facilities.map((f) => (
                  <tr key={f.npi} className={f.existingAccountId ? "bg-slate-50 text-slate-400" : "text-slate-700"}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(f.npi)}
                        disabled={!!f.existingAccountId}
                        onChange={() => toggleSelected(f.npi)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{f.organizationName}</td>
                    <td className="px-3 py-2">{f.facilityType}</td>
                    <td className="px-3 py-2">{f.city ?? "—"}</td>
                    <td className="px-3 py-2">
                      {f.authorizedOfficial ? (
                        <span>
                          {f.authorizedOfficial.fullName}
                          {f.authorizedOfficial.title ? (
                            <span className="text-xs text-slate-400"> · {f.authorizedOfficial.title}</span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {f.authorizedOfficial?.phone ?? f.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {f.existingAccountId ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">In CRM</span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">New</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
