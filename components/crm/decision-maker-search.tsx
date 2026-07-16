"use client";

import { useAdminToken } from "@/lib/use-admin-token";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Contact = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  confidenceScore: number | null;
  source: string | null;
};

type SearchResult = {
  account: { id: string; companyName: string; website: string | null } | null;
  contacts: Contact[];
  source: string;
  note?: string;
};

function confidenceBadge(score: number | null) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-emerald-100 text-emerald-700" :
    pct >= 60 ? "bg-blue-100 text-blue-700" :
    "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${color}`}>{pct}%</span>;
}

function sourceBadge(source: string) {
  const label =
    source === "existing" ? "Cached" :
    source === "apollo_enriched" ? "Apollo ✓" :
    source === "apollo_search" ? "Apollo" :
    source === "apollo+hunter" ? "Apollo + Hunter" :
    source.replace(/_/g, " ");
  const color =
    source === "existing" ? "bg-amber-100 text-amber-700" :
    source.includes("apollo") ? "bg-blue-100 text-blue-700" :
    source.includes("hunter") ? "bg-violet-100 text-violet-700" :
    source.includes("serper") ? "bg-cyan-100 text-cyan-700" :
    "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>;
}

export function DecisionMakerSearch() {
  const [adminToken, handleTokenChange] = useAdminToken();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState("");
  const [region, setRegion] = useState("");
  const [refresh, setRefresh] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // When fresh preview results arrive, pre-select the contacts worth keeping —
  // anyone with an email or phone. Name-only hits (common from web search) start
  // unchecked so junk leads don't get saved unless the user opts in.
  useEffect(() => {
    if (!result || result.source === "existing") {
      setSelectedIds(new Set());
      return;
    }
    const worthKeeping = result.contacts.filter((c) => c.email || c.phone);
    const defaults = (worthKeeping.length ? worthKeeping : result.contacts).map((c) => c.id);
    setSelectedIds(new Set(defaults));
  }, [result]);

  const isPreview = !!result && result.source !== "existing";
  const selectedCount = selectedIds.size;
  const allSelected = useMemo(
    () => !!result && result.contacts.length > 0 && result.contacts.every((c) => selectedIds.has(c.id)),
    [result, selectedIds],
  );

  function toggleContact(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!result) return;
    setSelectedIds(allSelected ? new Set() : new Set(result.contacts.map((c) => c.id)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/decision-makers/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          companyName,
          website: website || null,
          state: state || null,
          region: region || null,
          refresh,
          persistToCrm: false,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed");
      }

      const data = payload.data as SearchResult;
      setResult(data);
      const label = data.account?.companyName ?? companyName;
      const msg =
        data.source === "existing"
          ? `Loaded ${data.contacts.length} cached contact(s) for ${label} from CRM.`
          : `Found ${data.contacts.length} decision maker(s) for ${label}.`;
      setStatus({ type: "success", text: msg });
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function addToCrm() {
    if (!result) return;

    const contactsToSave = result.contacts.filter((contact) => selectedIds.has(contact.id));
    if (!contactsToSave.length) {
      setStatus({ type: "error", text: "Select at least one contact to add to the CRM." });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/discovery/add-to-crm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          companyName,
          website: website || null,
          state: state || null,
          region: region || null,
          contacts: contactsToSave.map((contact) => ({
            fullName:
              contact.fullName ||
              `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
              "Unknown",
            firstName: contact.firstName,
            lastName: contact.lastName,
            title: contact.title,
            department: contact.department,
            email: contact.email,
            phone: contact.phone,
            linkedinUrl: contact.linkedinUrl,
            confidenceScore: contact.confidenceScore,
            // Preserve each contact's own provider so the CRM records where the
            // data actually came from, not the aggregate of all providers.
            source: contact.source ?? result.source,
          })),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to add to CRM");
      setStatus({
        type: "success",
        text: `Added ${payload.data.account.companyName} to CRM with ${payload.data.contacts.length} contact(s).`,
      });
      setResult({
        ...result,
        account: payload.data.account,
      });
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  const statusColors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-rose-50 border-rose-200 text-rose-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Admin Token</span>
            <input
              type="password"
              value={adminToken}
              onChange={(event) => handleTokenChange(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Stored in browser after first entry"
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Company Name <span className="text-rose-500">*</span></span>
            <input
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Acme Logistics"
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Website <span className="text-slate-400 font-normal">(optional, improves results)</span></span>
            <input
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="https://acme.com"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">State</span>
              <input
                type="text"
                value={state}
                onChange={(event) => setState(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="TX"
                maxLength={3}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Region</span>
              <input
                type="text"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="South"
              />
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={refresh}
            onChange={(event) => setRefresh(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          Force refresh from internet providers (ignore cached contacts)
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800 transition-colors"
          >
            {loading ? "Searching…" : "Search Decision Makers"}
          </button>
          <button
            type="button"
            onClick={addToCrm}
            disabled={saving || !isPreview || selectedCount === 0}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-blue-600 transition-colors"
            title={
              result?.source === "existing"
                ? "Already in CRM"
                : selectedCount === 0
                  ? "Select at least one contact"
                  : "Save account and selected contacts to CRM"
            }
          >
            {saving
              ? "Saving…"
              : result?.account
                ? `Update CRM (${selectedCount})`
                : `Add ${selectedCount} to CRM`}
          </button>
          {result?.account ? (
            <a
              href={`/crm/accounts/${result.account.id}`}
              className="text-sm text-blue-700 hover:underline"
            >
              Open account →
            </a>
          ) : null}
        </div>
      </form>

      {status ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${statusColors[status.type]}`}>
          {status.text}
        </div>
      ) : null}

      {result && result.contacts.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">
                {result.account?.companyName ?? companyName}
              </h3>
              {sourceBadge(result.source)}
            </div>
            <span className="text-xs text-slate-500">
              {isPreview
                ? `${selectedCount} of ${result.contacts.length} selected`
                : `${result.contacts.length} contact(s)`}
            </span>
          </div>
          {result.note ? (
            <p className="px-5 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              {result.note}
            </p>
          ) : null}
          {isPreview ? (
            <p className="px-5 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              Contacts with an email or phone are pre-selected. Uncheck anyone you don&apos;t
              want, then click <span className="font-medium">Add to CRM</span>.
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-medium uppercase tracking-wide">
                <tr>
                  {isPreview ? (
                    <th className="px-5 py-3 text-left w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        aria-label="Select all contacts"
                      />
                    </th>
                  ) : null}
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Title</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Phone</th>
                  <th className="px-5 py-3 text-left">LinkedIn</th>
                  <th className="px-5 py-3 text-left">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className={`transition-colors ${
                      isPreview && !selectedIds.has(contact.id)
                        ? "bg-slate-50/60 hover:bg-slate-100"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {isPreview ? (
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(contact.id)}
                          onChange={() => toggleContact(contact.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          aria-label={`Select ${contact.fullName ?? "contact"}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {contact.fullName || `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{contact.title ?? "—"}</td>
                    <td className="px-5 py-3">
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="text-blue-700 hover:underline">
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{contact.phone ?? "—"}</td>
                    <td className="px-5 py-3">
                      {contact.linkedinUrl ? (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:underline text-xs"
                        >
                          View profile
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {confidenceBadge(contact.confidenceScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : result && result.contacts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
          <p className="text-sm text-slate-500">No decision makers found for this company.</p>
          <p className="mt-1 text-xs text-slate-400">
            Try adding a website URL, or check that SERPER_API_KEY and HUNTER_API_KEY are configured.
          </p>
        </div>
      ) : null}
    </div>
  );
}
