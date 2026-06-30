"use client";

import { TaskType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AccountOption = { id: string; companyName: string };

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: TaskType.CALL, label: "Call" },
  { value: TaskType.EMAIL_FOLLOWUP, label: "Email Follow-up" },
  { value: TaskType.VERIFY_CONTACT, label: "Verify Contact" },
  { value: TaskType.RESEARCH, label: "Research" },
];

export function CreateTaskModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountQuery, setAccountQuery] = useState("");
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [taskType, setTaskType] = useState<TaskType>(TaskType.RESEARCH);
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");

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
    setTaskType(TaskType.RESEARCH);
    setNotes("");
    setDueAt("");
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!selectedAccount) {
      setError("Select an account first.");
      return;
    }
    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setError("Write task notes before saving.");
      return;
    }
    if (!dueAt) {
      setError("Due date is required.");
      return;
    }
    const parsed = new Date(`${dueAt}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      setError("Invalid due date.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/accounts/${selectedAccount.id}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: taskType, notes: trimmedNotes, dueAt: parsed.toISOString() }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to create task");
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
        + New Task
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-lg">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Task</h3>
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

              <div>
                <label className="mb-1 block text-sm text-slate-700">Task Type</label>
                <select
                  value={taskType}
                  onChange={(event) => setTaskType(event.target.value as TaskType)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Notes *</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="What needs to be done?"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Due Date *</label>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {error ? <p className="text-xs text-red-600">{error}</p> : null}

              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
