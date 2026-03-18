"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IssueStatus, IssueType } from "@prisma/client";

type IssueRow = {
  id: string;
  issueType: IssueType;
  reportedBy: string;
  note: string | null;
  status: IssueStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolveNote: string | null;
};

type DeliveryIssuePanelProps = {
  deliveryId: string;
  issues: IssueRow[];
  canReport?: boolean;
};

const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  delayed: "Delayed",
  customer_unavailable: "Customer Unavailable",
  pickup_problem: "Pickup Problem",
  address_issue: "Address Issue",
  vehicle_problem: "Vehicle Problem",
  other: "Other",
};

function fmt(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toISOString().slice(0, 16).replace("T", " ");
}

export function DeliveryIssuePanel({
  deliveryId,
  issues,
  canReport = false,
}: DeliveryIssuePanelProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [issueType, setIssueType] = useState<IssueType>(IssueType.delayed);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  async function submitIssue() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueType, note: note || null, reportedBy: "driver" }),
      });
      if (!res.ok) throw new Error("Failed to report issue.");
      setShowForm(false);
      setNote("");
      setStatus("Issue reported.");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function resolveIssue(issueId: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolvedBy: "dispatcher", resolveNote: resolveNote || null }),
      });
      if (!res.ok) throw new Error("Failed to resolve issue.");
      setResolveId(null);
      setResolveNote("");
      setStatus("Issue resolved.");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const openIssues = issues.filter((i) => i.status === "open");
  const resolvedIssues = issues.filter((i) => i.status === "resolved");

  return (
    <div className="space-y-4">
      {status ? (
        <p className={`rounded-md px-3 py-2 text-sm ${status.includes("Error") || status.includes("Failed") ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          {status}
        </p>
      ) : null}

      {/* Open issues */}
      {openIssues.length > 0 ? (
        <div className="space-y-2">
          {openIssues.map((issue) => (
            <div key={issue.id} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-rose-800">
                    {ISSUE_TYPE_LABELS[issue.issueType]}
                  </p>
                  {issue.note ? (
                    <p className="text-xs text-rose-700 italic">"{issue.note}"</p>
                  ) : null}
                  <p className="text-xs text-rose-500">
                    Reported by {issue.reportedBy} at {fmt(issue.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setResolveId(resolveId === issue.id ? null : issue.id)}
                  className="shrink-0 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                >
                  Resolve
                </button>
              </div>

              {resolveId === issue.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    rows={2}
                    placeholder="Resolution note (optional)..."
                    className="w-full rounded-md border border-rose-300 px-2 py-1.5 text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveIssue(issue.id)}
                      disabled={busy}
                      className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Mark Resolved"}
                    </button>
                    <button
                      onClick={() => setResolveId(null)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No open issues.</p>
      )}

      {/* Report issue form */}
      {canReport ? (
        showForm ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report Issue</p>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {Object.entries(ISSUE_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Describe the issue (optional)..."
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={submitIssue}
                disabled={busy}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Submit Issue"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-lg border border-dashed border-rose-300 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            + Report Issue
          </button>
        )
      ) : null}

      {/* Resolved issues (collapsed) */}
      {resolvedIssues.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
            {resolvedIssues.length} resolved issue{resolvedIssues.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 space-y-1.5">
            {resolvedIssues.map((issue) => (
              <li key={issue.id} className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs">
                <p className="font-medium text-slate-600">
                  {ISSUE_TYPE_LABELS[issue.issueType]} — resolved by {issue.resolvedBy}
                </p>
                {issue.resolveNote ? (
                  <p className="text-slate-500 italic">"{issue.resolveNote}"</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
