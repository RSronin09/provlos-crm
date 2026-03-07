"use client";

import { FormEvent, useState } from "react";

type Contact = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  confidenceScore: number | null;
};

type SearchResult = {
  account: { id: string; companyName: string; website: string | null } | null;
  contacts: Contact[];
  source: string;
  note?: string;
};

export function DecisionMakerSearch() {
  const [adminToken, setAdminToken] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState("");
  const [region, setRegion] = useState("");
  const [refresh, setRefresh] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

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

      setResult(payload.data as SearchResult);
      setStatus(`Found ${payload.data.contacts.length} decision makers for ${payload.data.account.companyName}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function addToCrm() {
    if (!result) return;

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
          contacts: result.contacts.map((contact) => ({
            fullName:
              contact.fullName ||
              `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
              "Unknown",
            firstName: contact.firstName,
            lastName: contact.lastName,
            title: contact.title,
            email: contact.email,
            phone: contact.phone,
            confidenceScore: contact.confidenceScore,
            source: result.source,
          })),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to add to CRM");
      setStatus(
        `Added ${payload.data.account.companyName} to CRM with ${payload.data.contacts.length} contacts.`,
      );
      setResult({
        ...result,
        account: payload.data.account,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Admin Token</span>
            <input
              type="password"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Company Name</span>
            <input
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Acme Logistics"
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Website (optional)</span>
            <input
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="TX"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Region</span>
              <input
                type="text"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="South"
              />
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={refresh}
            onChange={(event) => setRefresh(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Force refresh from internet providers (ignore cached contacts)
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search Decision Makers"}
          </button>
          <button
            type="button"
            onClick={addToCrm}
            disabled={saving || !result}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Adding..." : "Add to CRM"}
          </button>
        </div>
      </form>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      {result ? (
        <section className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h3 className="text-lg font-semibold">
            {result.account?.companyName ?? companyName} ({result.source})
          </h3>
          {result.account ? (
            <a
              href={`/crm/accounts/${result.account.id}`}
              className="inline-block text-sm text-blue-700 hover:underline"
            >
              Open account record
            </a>
          ) : null}
          {result.note ? <p className="text-sm text-slate-600">{result.note}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {result.contacts.map((contact) => (
                  <tr key={contact.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">
                      {contact.fullName || `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "-"}
                    </td>
                    <td className="px-3 py-2">{contact.title ?? "-"}</td>
                    <td className="px-3 py-2">{contact.email ?? "-"}</td>
                    <td className="px-3 py-2">{contact.phone ?? "-"}</td>
                    <td className="px-3 py-2">
                      {typeof contact.confidenceScore === "number"
                        ? contact.confidenceScore.toFixed(2)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
