"use client";

import { useRef, useState } from "react";

type RowResult = {
  contactId: string;
  name: string | null;
  company: string;
  email: string | null;
  source: string | null;
};

type PanelState = "idle" | "running" | "stopping" | "done";

export function FindMissingEmailsPanel({
  totalContacts,
  contactsWithEmail,
}: {
  totalContacts: number;
  contactsWithEmail: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PanelState>("idle");
  const [processed, setProcessed] = useState(0);
  const [found, setFound] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [rows, setRows] = useState<RowResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stopRequested = useRef(false);

  const missing = totalContacts - contactsWithEmail;
  const coveragePct = totalContacts ? Math.round((contactsWithEmail / totalContacts) * 100) : 0;

  async function run() {
    setState("running");
    setError(null);
    setProcessed(0);
    setFound(0);
    setRows([]);
    stopRequested.current = false;

    let cursor: string | null = null;
    let totalProcessed = 0;
    let totalFound = 0;

    try {
      do {
        const response: Response = await fetch("/api/discovery/find-missing-emails", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ batchSize: 10, ...(cursor ? { cursor } : {}) }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "Batch request failed");

        const data = payload.data;
        totalProcessed += data.processed;
        totalFound += data.found;
        setProcessed(totalProcessed);
        setFound(totalFound);
        setRemaining(Math.max(0, (data.totalMissing ?? 0) - totalProcessed));
        setRows((prev) => [...data.results.filter((r: RowResult) => r.email), ...prev].slice(0, 50));

        cursor = data.nextCursor;
      } while (cursor && !stopRequested.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }

    setState("done");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Find Missing Emails ({missing})
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => state !== "running" && setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Find Missing Emails</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {contactsWithEmail} of {totalContacts} contacts have an email ({coveragePct}% coverage) —{" "}
                {missing} to go.
              </p>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {state === "idle" && (
                <div className="space-y-2 text-sm text-slate-700">
                  <p>
                    Runs the full email-finding cascade on every contact without an email, cheapest source
                    first:
                  </p>
                  <ol className="list-decimal pl-5 text-xs text-slate-600 space-y-0.5">
                    <li>Facility website scrape (free)</li>
                    <li>Google search for published emails (Serper)</li>
                    <li>Hunter email finder</li>
                    <li>Apollo / PDL backups (only if configured)</li>
                    <li>Guess-and-verify common formats via Instantly&apos;s verifier</li>
                  </ol>
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                    Runs in batches of 10 and can be stopped anytime — progress is saved as it goes. Expect
                    roughly 30–50% hit rate on facility decision-makers; small owner-operated facilities often
                    have no published email anywhere.
                  </p>
                </div>
              )}

              {state !== "idle" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">{processed}</span> processed ·{" "}
                      <span className="font-semibold text-emerald-700">{found}</span> emails found
                      {remaining !== null ? <span className="text-slate-400"> · ~{remaining} left</span> : null}
                    </div>
                    {state === "running" && (
                      <svg className="h-4 w-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                  </div>

                  {rows.length > 0 && (
                    <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {rows.map((row) => (
                        <div key={row.contactId} className="px-3 py-2 text-xs">
                          <span className="font-medium text-slate-700">{row.name}</span>
                          <span className="text-slate-400"> — {row.company}</span>
                          <div className="text-emerald-700">
                            {row.email} <span className="text-slate-400">via {row.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {error} — progress up to this point is saved; run again to continue.
                    </div>
                  )}

                  {state === "done" && !error && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      Finished: {found} new email{found === 1 ? "" : "s"} across {processed} contacts.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              {state === "idle" && (
                <>
                  <button
                    onClick={run}
                    disabled={missing === 0}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Start ({missing} contacts)
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
                <button
                  onClick={() => {
                    stopRequested.current = true;
                    setState("stopping");
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Stop After This Batch
                </button>
              )}
              {state === "stopping" && (
                <p className="text-xs text-slate-500 self-center">Finishing current batch…</p>
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
