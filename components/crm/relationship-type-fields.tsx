"use client";

import { getTypeConfig } from "@/lib/account-types";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RelationshipTypeFieldsProps = {
  accountId: string;
  accountType: string | null | undefined;
  fields: {
    paymentTerms: string | null;
    taxId: string | null;
    accountNumber: string | null;
    creditLimit: number | null;
    contractStart: string | null;
    contractEnd: string | null;
    whatTheyMove: string | null;
    whyHireCouriers: string | null;
  };
};

export function RelationshipTypeFields({
  accountId,
  accountType,
  fields,
}: RelationshipTypeFieldsProps) {
  const config = getTypeConfig(accountType);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [form, setForm] = useState({
    paymentTerms: fields.paymentTerms ?? "",
    taxId: fields.taxId ?? "",
    accountNumber: fields.accountNumber ?? "",
    creditLimit: fields.creditLimit?.toString() ?? "",
    contractStart: fields.contractStart?.slice(0, 10) ?? "",
    contractEnd: fields.contractEnd?.slice(0, 10) ?? "",
    whatTheyMove: fields.whatTheyMove ?? "",
    whyHireCouriers: fields.whyHireCouriers ?? "",
  });

  if (config.detailFields.length === 0) return null;

  type FormKey = keyof typeof form;

  const visibleFields = config.detailFields.filter((f) => f.key in form);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const body: Record<string, unknown> = {
        paymentTerms: form.paymentTerms || null,
        taxId: form.taxId || null,
        accountNumber: form.accountNumber || null,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
        contractStart: form.contractStart || null,
        contractEnd: form.contractEnd || null,
        whatTheyMove: form.whatTheyMove || null,
        whyHireCouriers: form.whyHireCouriers || null,
      };
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save.");
      setEditing(false);
      setStatus("Saved.");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error saving.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">{config.label} Details</h3>
        <button
          type="button"
          onClick={() => setEditing((prev) => !prev)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          {visibleFields.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="mb-1 block text-slate-600">{f.label}</span>
              <input
                type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                value={form[f.key as FormKey]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
            </label>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            Save
          </button>
        </div>
      ) : (
        <dl className="space-y-2 text-sm">
          {visibleFields.map((f) => {
            const val = form[f.key as FormKey];
            return (
              <div key={f.key} className="grid grid-cols-2 gap-1">
                <dt className="text-slate-500">{f.label}</dt>
                <dd className="font-medium text-slate-800">
                  {f.type === "number" && val ? `$${Number(val).toLocaleString()}` : val || "—"}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {status ? <p className="mt-2 text-xs text-slate-500">{status}</p> : null}
    </div>
  );
}
