"use client";

import { StageBadge } from "@/components/crm/ui/stage-badge";
import Link from "next/link";
import { useMemo, useState } from "react";

type Stage =
  | "TARGET"
  | "ENRICHING"
  | "ENRICHED"
  | "CONTACTED"
  | "ENGAGED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "WON"
  | "LOST";

type PipelineStage = Exclude<Stage, "ENRICHED" | "ENGAGED">;

type PipelineAccount = {
  id: string;
  companyName: string;
  industry: string | null;
  stage: Stage;
  priorityScore: number | null;
  contactsCount: number;
  lastActivityAt: string | null;
};

type PipelineBoardProps = {
  accounts: PipelineAccount[];
};

const STAGES: PipelineStage[] = [
  "TARGET",
  "ENRICHING",
  "QUALIFIED",
  "CONTACTED",
  "PROPOSAL",
  "WON",
  "LOST",
];

type PendingMove = {
  accountId: string;
  toStage: PipelineStage;
};

function renderStage(stage: Stage): PipelineStage {
  // Legacy ENRICHED/ENGAGED records should remain visible after removing those lanes.
  if (stage === "ENRICHED" || stage === "ENGAGED") {
    return "CONTACTED";
  }
  return stage;
}

export function PipelineBoard({ accounts: initialAccounts }: PipelineBoardProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moveNote, setMoveNote] = useState("");
  const [noteFrom, setNoteFrom] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const byStage = useMemo(
    () =>
      Object.fromEntries(
        STAGES.map((stage) => [
          stage,
          accounts.filter((account) => renderStage(account.stage) === stage),
        ]),
      ) as Record<PipelineStage, PipelineAccount[]>,
    [accounts],
  );

  function onDrop(toStage: PipelineStage) {
    if (!draggedId) return;
    const account = accounts.find((item) => item.id === draggedId);
    if (!account || renderStage(account.stage) === toStage) return;
    setPendingMove({ accountId: draggedId, toStage });
    setMoveNote("");
    setNoteFrom("");
    setStatus(null);
  }

  async function submitMove() {
    if (!pendingMove) return;
    if (!moveNote.trim()) {
      setStatus("A note is required before moving this account.");
      return;
    }
    if (!noteFrom.trim()) {
      setStatus("Name is required in 'Note from' before moving this account.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/accounts/${pendingMove.accountId}/move-stage`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          toStage: pendingMove.toStage,
          note: moveNote.trim(),
          noteFrom: noteFrom.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to move stage");
      }

      setAccounts((prev) =>
        prev.map((account) =>
          account.id === pendingMove.accountId
            ? { ...account, stage: pendingMove.toStage, lastActivityAt: new Date().toISOString() }
            : account,
        ),
      );
      setStatus(`Moved account to ${pendingMove.toStage}.`);
      setPendingMove(null);
      setMoveNote("");
      setNoteFrom("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* On mobile: horizontal snap-scroll; on xl: 3-column grid */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 md:-mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
        {STAGES.map((stage) => (
          <section
            key={stage}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(stage)}
            className="w-[78vw] flex-shrink-0 snap-start rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:w-auto"
          >
            <div className="mb-3 flex items-center justify-between">
              <StageBadge stage={stage} />
              <span className="text-xs text-slate-500">{byStage[stage].length}</span>
            </div>
            <div className="space-y-2">
              {byStage[stage].map((account) => (
                <article
                  key={account.id}
                  draggable
                  onDragStart={() => setDraggedId(account.id)}
                  onDragEnd={() => setDraggedId(null)}
                  className="cursor-grab rounded-md border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 active:cursor-grabbing"
                >
                  <Link
                    href={`/crm/accounts/${account.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="text-sm font-medium text-slate-800 hover:text-blue-700 hover:underline"
                  >
                    {account.companyName}
                  </Link>
                  <p className="text-xs text-slate-600">{account.industry ?? "No industry"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Priority: {account.priorityScore ?? "-"} | Contacts: {account.contactsCount}
                  </p>
                  <p className="text-xs text-slate-500">
                    Last Activity:{" "}
                    {account.lastActivityAt
                      ? new Date(account.lastActivityAt).toISOString().slice(0, 10)
                      : "-"}
                  </p>
                  <select
                    value=""
                    onChange={(event) => {
                      const target = event.target.value as PipelineStage;
                      if (!target) return;
                      setDraggedId(account.id);
                      onDrop(target);
                      event.target.value = "";
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="">Move to stage...</option>
                    {STAGES.filter((s) => s !== renderStage(account.stage)).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
              {!byStage[stage].length ? (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500">
                  Drop account card here.
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      {pendingMove ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-lg">
            {/* Drag handle (mobile) */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <h3 className="text-lg font-semibold">Add note for stage move</h3>
            <p className="mt-1 text-sm text-slate-600">
              A note is required when moving an account to {pendingMove.toStage}.
            </p>
            <input
              value={noteFrom}
              onChange={(event) => setNoteFrom(event.target.value)}
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Note from (your name)"
            />
            <textarea
              value={moveNote}
              onChange={(event) => setMoveNote(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Why is this account moving stages?"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingMove(null);
                  setMoveNote("");
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitMove}
                disabled={submitting}
                className="rounded-md bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {submitting ? "Moving..." : "Confirm Move"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {status ? (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
          {status}
        </p>
      ) : null}
    </div>
  );
}
