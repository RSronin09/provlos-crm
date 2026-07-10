"use client";

import { useState } from "react";

type EnrichResult = {
  contactsAdded: number;
  contactsUpdated: number;
  totalContacts: number;
  providersUsed: string[];
  note?: string | null;
};

export function EnrichButton({ accountId }: { accountId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEnrich = async () => {
    setStatus("loading");
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/discovery/enrich-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error || "Enrichment failed");
        setStatus("error");
      } else {
        setResult(json.data);
        setStatus("done");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleEnrich}
        disabled={status === "loading"}
        className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Finding decision makers…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            Enrich — Find Decision Makers
          </span>
        )}
      </button>

      {status === "done" && result && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
          {result.contactsAdded > 0 || result.contactsUpdated > 0 ? (
            <>
              {result.contactsAdded > 0 && (
                <span>✓ {result.contactsAdded} new contact{result.contactsAdded !== 1 ? "s" : ""} added</span>
              )}
              {result.contactsAdded > 0 && result.contactsUpdated > 0 && <span> · </span>}
              {result.contactsUpdated > 0 && (
                <span>✓ {result.contactsUpdated} contact{result.contactsUpdated !== 1 ? "s" : ""} updated with email/phone</span>
              )}
              {" "}via {result.providersUsed.join(", ")}
            </>
          ) : (
            `Search complete — no new data found (${result.totalContacts} contacts checked).`
          )}
        </div>
      )}

      {status === "done" && result?.note && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          {result.note}
        </div>
      )}

      {status === "error" && errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
