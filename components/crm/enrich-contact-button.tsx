"use client";

import { useState } from "react";

type Props = {
  contactId: string;
  hasEmail: boolean;
  hasPhone: boolean;
};

export function EnrichContactButton({ contactId, hasEmail, hasPhone }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "no_match" | "error">("idle");
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  // Only show if at least one field is missing
  if (hasEmail && hasPhone) return null;

  const handleEnrich = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus("loading");
    setResultMsg(null);

    try {
      const res = await fetch("/api/discovery/enrich-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });

      const json = await res.json();

      if (!res.ok) {
        setStatus("error");
        setResultMsg(json.error || "Enrichment failed");
        return;
      }

      if (!json.data?.updated) {
        setStatus("no_match");
        setResultMsg(json.data?.reason || "No match found");
        return;
      }

      setStatus("done");
      const parts = [];
      if (json.data.email) parts.push(json.data.email);
      if (json.data.phone) parts.push(json.data.phone);
      setResultMsg(parts.join(" · ") || "Updated");

      // Reload to show new data
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setStatus("error");
      setResultMsg("Network error");
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      {status === "idle" && (
        <button
          onClick={handleEnrich}
          title="Look up email & phone via Apollo"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 transition"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          Enrich
        </button>
      )}
      {status === "loading" && (
        <span className="inline-flex items-center gap-1 text-xs text-blue-500">
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Searching…
        </span>
      )}
      {status === "done" && (
        <span className="text-xs text-green-600 font-medium">✓ {resultMsg}</span>
      )}
      {status === "no_match" && (
        <span className="text-xs text-slate-400" title={resultMsg ?? ""}>No match</span>
      )}
      {status === "error" && (
        <span className="text-xs text-red-500">{resultMsg}</span>
      )}
    </span>
  );
}
