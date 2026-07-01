"use client";

import { useState } from "react";

export function EnrichAccountRowButton({ accountId }: { accountId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [summary, setSummary] = useState<string | null>(null);

  const handleEnrich = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus("loading");
    setSummary(null);

    try {
      const res = await fetch("/api/discovery/enrich-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setSummary(json.error ?? "Failed");
        return;
      }

      const added = json.data?.contactsAdded ?? 0;
      const updated = json.data?.contactsUpdated ?? 0;
      const total = added + updated;
      setStatus("done");
      setSummary(total > 0 ? `+${total}` : "No new data");
    } catch {
      setStatus("error");
      setSummary("Network error");
    }
  };

  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-500">
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </span>
    );
  }

  if (status === "done") {
    return (
      <span className={`text-xs font-medium ${summary === "No new data" ? "text-slate-400" : "text-green-600"}`}>
        {summary}
      </span>
    );
  }

  if (status === "error") {
    return <span className="text-xs text-red-500" title={summary ?? ""}>{summary}</span>;
  }

  return (
    <button
      onClick={handleEnrich}
      title="Enrich — find decision maker contacts"
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition whitespace-nowrap"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
      </svg>
      Enrich
    </button>
  );
}
