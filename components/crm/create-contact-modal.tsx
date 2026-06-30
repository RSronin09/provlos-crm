"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AccountOption = { id: string; companyName: string };

export function CreateContactModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountQuery, setAccountQuery] = useState("");
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    title: "",
    department: "",
    email: "",
    phone: "",
    linkedinUrl: "",
  });

  useEffect(() => {
    if (!open) return;
    if (!accountQuery.trim() || selectedAccount) {
      setAccountOptions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/accounts?search=${encodeURIComponent(accountQuery.trim())}&pageSize=8`);
        const json = await res.json();
        setAccountOptions(json.data ?? []);
      } catch {
        setAccountOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [accountQuery, open, selectedAccount]);

  function reset() {
    setAccountQuery("");
    setAccountOptions([]);
    setSelectedAccount(null);
    setForm({ fullName: "", title: "", department: "", email: "", phone: "", linkedinUrl: "" });
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!selectedAccount) {
      setError("Select an account first.");
      return;
    }
    const fullName = form.fullName.trim();
    if (!fullName) {
      setError("Contact name is required.");
      return;
    }
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    const linkedinUrl = form.linkedinUrl.trim();
    if (linkedinUrl && !/^https?:\/\//i.test(linkedinUrl)) {
      setError("LinkedIn URL must start with http:// or https://");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/accounts/${selectedAccount.id}/contacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName,
          title: form.title.trim() || null,
          department: form.department.trim() || null,
          email: email || null,
          phone: form.phone.trim() || null,
          linkedinUrl: linkedinUrl || null,
          source: "manual",
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to create contact");
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
      >
        + Add Contact
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-lg max-h-[90vh] overflow-y-auto">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Contact</h3>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Account *</label>
                {selectedAccount ? (
                  <div className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <span>{selectedAccount.companyName}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedAccount(null)}
                      className="text-xs text-blue-700 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={accountQuery}
                      onChange={(event) => setAccountQuery(event.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Search company name..."
                    />
                    {accountQuery.trim() && (accountOptions.length > 0 || searching) ? (
                      <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                        {searching ? (
                          <p className="px-3 py-2 text-xs text-slate-400">Searching...</p>
                        ) : (
                          accountOptions.map((account) => (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() => {
                                setSelectedAccount(account);
                                setAccountOptions([]);
                              }}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              {account.companyName}
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <input
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Full name *"
              />
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Title"
              />
              <input
                value={form.department}
                onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Department"
              />
              <input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                type="email"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Email"
              />
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Phone"
              />
              <input
                value={form.linkedinUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, linkedinUrl: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="LinkedIn URL"
              />

              {error ? <p className="text-xs text-red-600">{error}</p> : null}

              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? "Creating..." : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
