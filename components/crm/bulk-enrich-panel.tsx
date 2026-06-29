"use client";

import { useState } from "react";

type AccountRef = {
  id: string;
  companyName: string;
  contactCount: number;
};

type EnrichState = "idle" | "running" | "done";

type RowResult = {
  accountId: string;
  companyName: string;
  status: "pending" | "enriching" | "done" | "error";
  contactsAdded?: number;
  error?: string;
};

export function BulkEnrichPanel({
  accounts,
  entityLabel = "accounts",
}: {
  accounts: AccountRef[];
  entityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<EnrichState>("idle");
  const [rows, setRows] = useState<RowResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalAdded, setTotalAdded] = useState(0);

  const noContacts = accounts.filter((a) => a.contactCount === 0);
  const targets = noContacts.length > 0 ? noContacts : accounts;

  const handleStart = async () => {
    setState("running");
    setCurrentIdx(0);
    setTotalAdded(0);

    const initial: RowResult[] = targets.map((a) => ({
      accountId: a.id,
      companyName: a.companyName,
      status: "pending",
    }));
    setRows(initial);

    let added = 0;

    for (let i = 0; i < targets.length; i++) {
      const account = targets[i];
      setCurrentIdx(i);

      // Mark current as enriching
      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "enriching" } : r)),
      );

      try {
        const res = await fetch("/api/discovery/enrich-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: account.id }),
        });

        const json = await res.json();

        if (!res.ok) {
          setRows((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "error", error: json.error || "Failed" } : r,
            ),
          );
        } else {
          const contactsAdded: number = json.data?.contactsAdded ?? 0;
          added += contactsAdded;
          setTotalAdded(added);
          setRows((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "done", contactsAdded } : r,
            ),
          );
        }
      } catch {
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", error: "Network error" } : r,
          ),
        );
      }
    }

    setState("done");
  };

  const progress = state === "running" ? Math.round((currentIdx / targets.length) * 100) : 100;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        Enrich Decision Makers
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => state !== "running" && setOpen(false)}
          />

          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Enrich Decision Makers
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {noContacts.length > 0
                    ? `${noContacts.length} ${entityLabel} have no contacts yet`
                    : `${accounts.length} ${entityLabel} selected`}
                  {" — "}
                  looks up contacts via Serper &amp; Hunter.io
                </p>
              </div>
              {state !== "running" && (
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {state === "idle" && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">
                    This will search for decision makers at{" "}
                    <strong>{targets.length}</strong> {entityLabel} using live web and email
                    lookups. Each lookup takes ~5–10 seconds.
                  </p>
                  {noContacts.length > 0 && accounts.length > noContacts.length && (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                      Only enriching the {noContacts.length} {entityLabel} with no contacts yet.
                      Use the &ldquo;Enrich&rdquo; button on individual account pages to refresh others.
                    </p>
                  )}
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {targets.map((a) => (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-slate-700 truncate">{a.companyName}</span>
                        <span className="text-xs text-slate-400 shrink-0 ml-2">
                          {a.contactCount} contact{a.contactCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(state === "running" || state === "done") && rows.length > 0 && (
                <div className="space-y-3">
                  {/* Progress bar */}
                  {state === "running" && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>Enriching {targets[currentIdx]?.companyName}…</span>
                        <span>{currentIdx + 1} / {targets.length}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {state === "done" && (
                    <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-3">
                      <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-green-800">Enrichment complete</p>
                        <p className="text-xs text-green-700">
                          {totalAdded} new decision-maker contact{totalAdded !== 1 ? "s" : ""} added across {targets.length} {entityLabel}.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Per-account results */}
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    {rows.map((row) => (
                      <div key={row.accountId} className="flex items-center justify-between px-3 py-2 gap-2">
                        <span className="text-sm text-slate-700 truncate">{row.companyName}</span>
                        <span className="shrink-0 text-xs">
                          {row.status === "pending" && <span className="text-slate-400">Waiting</span>}
                          {row.status === "enriching" && (
                            <span className="flex items-center gap-1 text-blue-600">
                              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                              Searching…
                            </span>
                          )}
                          {row.status === "done" && (
                            <span className="text-green-600">
                              +{row.contactsAdded ?? 0} contacts
                            </span>
                          )}
                          {row.status === "error" && (
                            <span className="text-red-500">{row.error ?? "Error"}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              {state === "idle" && (
                <>
                  <button
                    onClick={handleStart}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Start Enrichment ({targets.length} {entityLabel})
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </>
              )}
              {state === "running" && (
                <p className="text-xs text-slate-500 self-center">
                  Please wait — do not close this window…
                </p>
              )}
              {state === "done" && (
                <button
                  onClick={() => {
                    setOpen(false);
                    window.location.reload();
                  }}
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Done — Reload Page
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
