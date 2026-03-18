"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeliveryStatus, DeliveryPriority } from "@prisma/client";

type Driver = { id: string; name: string };

type DeliveryDetailActionsProps = {
  deliveryId: string;
  currentStatus: DeliveryStatus;
  currentPriority: DeliveryPriority;
  currentDriverId: string | null;
  drivers: Driver[];
};

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  en_route_to_pickup: "En Route to Pickup",
  picked_up: "Picked Up",
  en_route_to_delivery: "En Route to Delivery",
  delivered: "Delivered",
  issue_reported: "Issue Reported",
  cancelled: "Cancelled",
};

export function DeliveryDetailActions({
  deliveryId,
  currentStatus,
  currentPriority,
  currentDriverId,
  drivers,
}: DeliveryDetailActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState(currentDriverId ?? "");
  const [selectedStatus, setSelectedStatus] = useState<DeliveryStatus>(currentStatus);
  const [selectedPriority, setSelectedPriority] = useState<DeliveryPriority>(currentPriority);

  async function run(action: () => Promise<void>, successMsg: string) {
    try {
      setBusy(true);
      setStatus(null);
      await action();
      setStatus(successMsg);
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignDriver() {
    await run(async () => {
      const res = await fetch(`/api/deliveries/${deliveryId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: selectedDriverId || null,
          changedBy: "dispatcher",
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error ?? "Failed to assign driver.");
      }
    }, "Driver updated.");
  }

  async function handleUpdateStatus() {
    await run(async () => {
      const res = await fetch(`/api/deliveries/${deliveryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus, changedBy: "dispatcher" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error ?? "Failed to update status.");
      }
    }, "Status updated.");
  }

  async function handleUpdatePriority() {
    await run(async () => {
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priorityLevel: selectedPriority }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error ?? "Failed to update priority.");
      }
    }, "Priority updated.");
  }

  async function handleCancel() {
    if (!confirm("Cancel this delivery? This cannot be undone easily.")) return;
    await run(async () => {
      const res = await fetch(`/api/deliveries/${deliveryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", changedBy: "dispatcher", note: "Cancelled by dispatcher." }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error ?? "Failed to cancel delivery.");
      }
    }, "Delivery cancelled.");
  }

  return (
    <div className="space-y-4">
      {status ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      ) : null}

      {/* Assign / Reassign Driver */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assign Driver</p>
        <div className="flex gap-2">
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Unassigned —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssignDriver}
            disabled={busy}
            className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Update Status */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update Status</p>
        <div className="flex gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as DeliveryStatus)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={handleUpdateStatus}
            disabled={busy}
            className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Update Priority */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update Priority</p>
        <div className="flex gap-2">
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as DeliveryPriority)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="standard">Standard</option>
            <option value="urgent">Urgent</option>
          </select>
          <button
            onClick={handleUpdatePriority}
            disabled={busy}
            className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Cancel */}
      {currentStatus !== "cancelled" && currentStatus !== "delivered" ? (
        <button
          onClick={handleCancel}
          disabled={busy}
          className="w-full rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          Cancel Delivery
        </button>
      ) : null}
    </div>
  );
}
