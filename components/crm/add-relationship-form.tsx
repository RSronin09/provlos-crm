"use client";

import {
  ACCOUNT_TYPE_CONFIG,
  ACCOUNT_TYPE_VALUES,
  AccountType,
  getTypeConfig,
} from "@/lib/account-types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ADMIN_TOKEN_KEY = "crm_admin_token";

const STAGE_VALUES = [
  "TARGET",
  "ENRICHING",
  "ENRICHED",
  "CONTACTED",
  "ENGAGED",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
] as const;

export function AddRelationshipForm() {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("CUSTOMER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    industry: "",
    orgType: "",
    website: "",
    phone: "",
    address1: "",
    city: "",
    state: "",
    zip: "",
    region: "",
    stage: "TARGET",
    notes: "",
    paymentTerms: "",
    taxId: "",
    accountNumber: "",
    creditLimit: "",
    contractStart: "",
    contractEnd: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (stored) setAdminToken(stored);
  }, []);

  function handleTokenChange(value: string) {
    setAdminToken(value);
    if (value) localStorage.setItem(ADMIN_TOKEN_KEY, value);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  const typeConfig = getTypeConfig(accountType);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        companyName: form.companyName,
        accountType,
        industry: form.industry || null,
        orgType: form.orgType || null,
        website: form.website || null,
        phone: form.phone || null,
        address1: form.address1 || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        region: form.region || null,
        stage: form.stage,
        notes: form.notes || null,
        paymentTerms: form.paymentTerms || null,
        taxId: form.taxId || null,
        accountNumber: form.accountNumber || null,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
        contractStart: form.contractStart || null,
        contractEnd: form.contractEnd || null,
      };

      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to create record.");
      router.push(`/crm/accounts/${payload.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      {/* Auth */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-800">Authentication</h3>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Admin Token</span>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => handleTokenChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            required
          />
        </label>
      </div>

      {/* Relationship type selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-800">Relationship Type</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACCOUNT_TYPE_VALUES.map((type) => {
            const cfg = ACCOUNT_TYPE_CONFIG[type];
            const selected = accountType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition-all ${
                  selected
                    ? `${cfg.badgeClass} ring-2 ring-offset-1 ring-current`
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <p className="font-semibold">{cfg.label}</p>
                <p className="text-xs opacity-70 mt-0.5 line-clamp-2">{cfg.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Core fields */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-800">Core Details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Company / Organization Name <span className="text-rose-500">*</span></span>
            <input
              type="text"
              {...field("companyName")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Stage</span>
            <select
              {...field("stage")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              {STAGE_VALUES.map((stage) => (
                <option key={stage} value={stage}>
                  {typeConfig.stageLabels[stage]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Industry</span>
            <input type="text" {...field("industry")} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Website</span>
            <input type="url" {...field("website")} placeholder="https://example.com" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Phone</span>
            <input type="tel" {...field("phone")} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Address</span>
            <input type="text" {...field("address1")} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" placeholder="Street address" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">City</span>
            <input type="text" {...field("city")} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">State</span>
              <input type="text" {...field("state")} maxLength={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">ZIP</span>
              <input type="text" {...field("zip")} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Region</span>
            <input type="text" {...field("region")} placeholder="South, Midwest, etc." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          </label>
        </div>
      </div>

      {/* Type-specific fields */}
      {typeConfig.detailFields.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-semibold text-slate-800">{typeConfig.label} Details</h3>
            <p className="text-sm text-slate-500 mt-0.5">{typeConfig.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {typeConfig.detailFields.map((f) => {
              const formKey = f.key as keyof typeof form;
              if (!(formKey in form)) return null;
              return (
                <label key={f.key} className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">{f.label}</span>
                  <input
                    type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                    {...field(formKey)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Notes */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-800">Notes</h3>
        <textarea
          {...field("notes")}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          placeholder="Internal notes about this relationship..."
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800 transition-colors"
        >
          {busy ? "Saving…" : `Add ${typeConfig.label}`}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
