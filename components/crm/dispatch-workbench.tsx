"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeliveryStatus, DeliveryPriority } from "@prisma/client";
import { DeliveryStatusBadge } from "@/components/crm/ui/delivery-status-badge";
import { PriorityBadge } from "@/components/crm/ui/priority-badge";
import Link from "next/link";

type DeliveryRow = {
  id: string;
  status: DeliveryStatus;
  priorityLevel: DeliveryPriority;
  pickupAddress: string;
  deliveryAddress: string;
  requestedDeliveryDateTime: string;
  assignedDriverId: string | null;
  dispatcherNotes: string | null;
  priorityScore: number;
  isOverdue: boolean;
  isAtRisk: boolean;
  hasOpenIssue: boolean;
  customer: { id: string; companyName: string } | null;
  assignedDriver: { id: string; name: string } | null;
};

type DriverRow = {
  id: string;
  name: string;
  openDeliveries: number;
  load: "low" | "medium" | "high";
};

type DispatchWorkbenchProps = {
  queue: DeliveryRow[];
  drivers: DriverRow[];
};

const STATUS_GROUPS: Array<{
  key: string;
  label: string;
  statuses: DeliveryStatus[];
  color: string;
}> = [
  {
    key: "unassigned",
    label: "Unassigned",
    statuses: [DeliveryStatus.pending],
    color: "text-rose-700 bg-rose-50 border-rose-200",
  },
  {
    key: "assigned",
    label: "Assigned",
    statuses: [DeliveryStatus.assigned],
    color: "text-blue-700 bg-blue-50 border-blue-200",
  },
  {
    key: "in_progress",
    label: "In Progress",
    statuses: [
      DeliveryStatus.en_route_to_pickup,
      DeliveryStatus.picked_up,
      DeliveryStatus.en_route_to_delivery,
    ],
    color: "text-amber-700 bg-amber-50 border-amber-200",
  },
  {
    key: "issues",
    label: "Issues",
    statuses: [DeliveryStatus.issue_reported],
    color: "text-rose-800 bg-rose-100 border-rose-300",
  },
];

const ALL_STATUSES: Record<DeliveryStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  en_route_to_pickup: "En Route to Pickup",
  picked_up: "Picked Up",
  en_route_to_delivery: "En Route to Delivery",
  delivered: "Delivered",
  issue_reported: "Issue Reported",
  cancelled: "Cancelled",
};

export function DispatchWorkbench({ queue, drivers }: DispatchWorkbenchProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const selected = queue.find((d) => d.id === selectedId) ?? null;

  async function run(action: () => Promise<void>, msg: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      setFeedback(msg);
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function assignDriver(driverId: string | null) {
    if (!selected) return;
    await run(async () => {
      const res = await fetch(`/api/deliveries/${selected.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, changedBy: "dispatcher" }),
      });
      if (!res.ok) throw new Error("Failed to assign driver.");
    }, driverId ? "Driver assigned." : "Driver removed.");
  }

  async function updateStatus(status: DeliveryStatus) {
    if (!selected) return;
    await run(async () => {
      const res = await fetch(`/api/deliveries/${selected.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, changedBy: "dispatcher" }),
      });
      if (!res.ok) throw new Error("Failed to update status.");
    }, "Status updated.");
  }

  async function saveNote() {
    if (!selected) return;
    await run(async () => {
      const res = await fetch(`/api/deliveries/${selected.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatcherNotes: noteText }),
      });
      if (!res.ok) throw new Error("Failed to save note.");
    }, "Note saved.");
  }

  async function updatePriority(priorityLevel: DeliveryPriority) {
    if (!selected) return;
    await run(async () => {
      const res = await fetch(`/api/deliveries/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priorityLevel }),
      });
      if (!res.ok) throw new Error("Failed to update priority.");
    }, "Priority updated.");
  }

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[600px] gap-3 overflow-hidden">
      {/* LEFT: Queue grouped by status */}
      <div className="w-64 shrink-0 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Queue ({queue.length})
          </p>
        </div>
        <div className="p-2 space-y-1">
          {STATUS_GROUPS.map((group) => {
            const items = queue.filter((d) => group.statuses.includes(d.status));
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <p className={`mb-1 mt-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${group.color} border`}>
                  {group.label} ({items.length})
                </p>
                {items.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelectedId(d.id);
                      setFeedback(null);
                      setNoteText(d.dispatcherNotes ?? "");
                    }}
                    className={`w-full rounded-md px-2.5 py-2 text-left transition-colors ${
                      selectedId === d.id
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <p className="truncate text-xs font-medium text-slate-800">
                      {d.customer?.companyName ?? d.deliveryAddress.slice(0, 22)}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">{d.deliveryAddress.slice(0, 28)}</p>
                    <div className="mt-1 flex items-center gap-1">
                      {d.isOverdue ? (
                        <span className="rounded-sm bg-rose-100 px-1 text-[9px] font-bold text-rose-600">OVERDUE</span>
                      ) : d.isAtRisk ? (
                        <span className="rounded-sm bg-amber-100 px-1 text-[9px] font-bold text-amber-600">AT RISK</span>
                      ) : null}
                      {d.hasOpenIssue ? (
                        <span className="rounded-sm bg-rose-100 px-1 text-[9px] font-bold text-rose-700">ISSUE</span>
                      ) : null}
                      {d.priorityLevel === "urgent" ? (
                        <span className="rounded-sm bg-rose-50 px-1 text-[9px] font-bold text-rose-500">URGENT</span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
          {queue.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-slate-400">Queue is clear.</p>
          ) : null}
        </div>
      </div>

      {/* MAIN: Selected delivery detail + actions */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Select a delivery from the queue.
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selected.customer?.companyName ?? "No Customer"}
                </h2>
                <p className="text-sm text-slate-500">
                  Delivery #{selected.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={selected.priorityLevel} />
                <DeliveryStatusBadge status={selected.status} />
                <Link
                  href={`/crm/deliveries/${selected.id}`}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Full Detail →
                </Link>
              </div>
            </div>

            {/* Alerts */}
            {selected.isOverdue ? (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
                ⚠ Overdue — past requested delivery deadline
              </div>
            ) : selected.isAtRisk ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
                ⏱ At Risk — deadline within 2 hours
              </div>
            ) : null}

            {feedback ? (
              <p className={`rounded-md px-3 py-2 text-sm ${
                feedback.includes("Error") || feedback.includes("Failed")
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}>
                {feedback}
              </p>
            ) : null}

            {/* Addresses */}
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400 mb-1">Pickup</p>
                <p className="text-slate-700">{selected.pickupAddress}</p>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400 mb-1">Delivery</p>
                <p className="text-slate-700">{selected.deliveryAddress}</p>
              </div>
            </div>

            <div className="text-sm text-slate-500">
              Requested by: <strong className="text-slate-800">
                {new Date(selected.requestedDeliveryDateTime).toLocaleString()}
              </strong>
            </div>

            {/* Assign Driver */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assign Driver</p>
              <div className="flex flex-wrap gap-2">
                {drivers.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => assignDriver(d.id)}
                    disabled={busy}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      selected.assignedDriverId === d.id
                        ? "border-blue-400 bg-blue-100 text-blue-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {d.name}
                    <span className={`ml-1.5 rounded-full px-1.5 text-[9px] font-bold ${
                      d.load === "low" ? "bg-emerald-100 text-emerald-700"
                      : d.load === "medium" ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                    }`}>
                      {d.openDeliveries}
                    </span>
                  </button>
                ))}
                {selected.assignedDriverId ? (
                  <button
                    onClick={() => assignDriver(null)}
                    disabled={busy}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            {/* Update Status */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ALL_STATUSES) as DeliveryStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={busy || s === selected.status}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-40 transition-colors ${
                      s === selected.status
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {ALL_STATUSES[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</p>
              <div className="flex gap-2">
                {(["standard", "urgent"] as DeliveryPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => updatePriority(p)}
                    disabled={busy || p === selected.priorityLevel}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-colors ${
                      p === selected.priorityLevel
                        ? p === "urgent" ? "border-rose-300 bg-rose-50 text-rose-700"
                          : "border-slate-300 bg-slate-100 text-slate-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Dispatcher Note */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dispatcher Note</p>
              <div className="flex gap-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  placeholder="Internal notes..."
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={saveNote}
                  disabled={busy}
                  className="self-start rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Driver Workload */}
      <div className="w-52 shrink-0 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Drivers</p>
        </div>
        <div className="p-2 space-y-1.5">
          {drivers.map((d) => (
            <div key={d.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{d.name}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{d.openDeliveries} open</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  d.load === "low" ? "bg-emerald-100 text-emerald-700"
                  : d.load === "medium" ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
                }`}>
                  {d.load}
                </span>
              </div>
            </div>
          ))}
          {drivers.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-4">No active drivers.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
