"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PersonInfoProps = {
  contactId: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  linkedinUrl: string | null;
  confidenceScore: number | null;
  source: string | null;
};

export function EditablePersonInfo({
  contactId,
  fullName,
  title,
  email,
  phone,
  department,
  linkedinUrl,
  confidenceScore,
  source,
}: PersonInfoProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName,
    title: title ?? "",
    email: email ?? "",
    phone: phone ?? "",
    department: department ?? "",
    linkedinUrl: linkedinUrl ?? "",
  });

  async function save() {
    setError(null);
    const trimmedName = form.fullName.trim();
    if (!trimmedName) {
      setError("Full name is required.");
      return;
    }
    const trimmedEmail = form.email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    const trimmedLinkedin = form.linkedinUrl.trim();
    if (trimmedLinkedin && !/^https?:\/\//i.test(trimmedLinkedin)) {
      setError("LinkedIn URL must start with http:// or https://");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: trimmedName,
          title: form.title.trim() || null,
          email: trimmedEmail || null,
          phone: form.phone.trim() || null,
          department: form.department.trim() || null,
          linkedinUrl: trimmedLinkedin || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to save changes.");
      }
      setStatus("Saved.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Person Info</h3>
        <button
          type="button"
          onClick={() => {
            if (editing) {
              setForm({
                fullName,
                title: title ?? "",
                email: email ?? "",
                phone: phone ?? "",
                department: department ?? "",
                linkedinUrl: linkedinUrl ?? "",
              });
            }
            setEditing((prev) => !prev);
            setError(null);
          }}
          className="rounded-md border border-slate-300 px-3 py-1 text-sm"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {error ? (
        <p className="mb-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {status && !editing ? (
        <p className="mb-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      ) : null}

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-500">Full name</span>
              <input
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Department</span>
              <input
                value={form.department}
                onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">LinkedIn URL</span>
              <input
                value={form.linkedinUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save Changes"}
          </button>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Email" value={email} />
          <Field label="Phone" value={phone} />
          <Field label="Department" value={department} />
          <Field label="LinkedIn" value={linkedinUrl} />
          <Field label="Confidence" value={confidenceScore?.toFixed(2)} />
          <Field label="Source" value={source} />
        </dl>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{value || "-"}</dd>
    </div>
  );
}
