"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeliveryStatus, IssueType } from "@prisma/client";

type DeliveryItem = {
  id: string;
  pickupAddress: string;
  deliveryAddress: string;
  requestedDeliveryDateTime: string;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  packageNotes: string | null;
  priorityLevel: string;
  status: DeliveryStatus;
  customer: { companyName: string } | null;
};

type DriverMobilePanelProps = {
  driverName: string;
  deliveries: DeliveryItem[];
};

const STATUS_ACTIONS: Array<{
  status: DeliveryStatus;
  label: string;
  color: string;
  applicableFrom: DeliveryStatus[];
}> = [
  {
    status: DeliveryStatus.en_route_to_pickup,
    label: "En Route to Pickup",
    color: "bg-indigo-600 hover:bg-indigo-700",
    applicableFrom: [DeliveryStatus.assigned, DeliveryStatus.pending],
  },
  {
    status: DeliveryStatus.picked_up,
    label: "Confirm Picked Up",
    color: "bg-violet-600 hover:bg-violet-700",
    applicableFrom: [DeliveryStatus.en_route_to_pickup],
  },
  {
    status: DeliveryStatus.en_route_to_delivery,
    label: "En Route to Delivery",
    color: "bg-amber-600 hover:bg-amber-700",
    applicableFrom: [DeliveryStatus.picked_up],
  },
  {
    status: DeliveryStatus.delivered,
    label: "Confirm Delivered",
    color: "bg-emerald-600 hover:bg-emerald-700",
    applicableFrom: [DeliveryStatus.en_route_to_delivery],
  },
];

const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  delayed: "Delayed",
  customer_unavailable: "Customer Unavailable",
  pickup_problem: "Pickup Problem",
  address_issue: "Address Issue",
  vehicle_problem: "Vehicle Problem",
  other: "Other",
};

const STATUS_COLOR: Record<DeliveryStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  assigned: "bg-blue-100 text-blue-700",
  en_route_to_pickup: "bg-indigo-100 text-indigo-700",
  picked_up: "bg-violet-100 text-violet-700",
  en_route_to_delivery: "bg-amber-100 text-amber-700",
  delivered: "bg-emerald-100 text-emerald-700",
  issue_reported: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-400",
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  en_route_to_pickup: "En Route to Pickup",
  picked_up: "Picked Up",
  en_route_to_delivery: "En Route to Delivery",
  delivered: "Delivered",
  issue_reported: "Issue Reported",
  cancelled: "Cancelled",
};

export function DriverMobilePanel({ driverName, deliveries }: DriverMobilePanelProps) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(
    deliveries.length > 0 ? deliveries[0].id : null
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [showIssueForm, setShowIssueForm] = useState<Record<string, boolean>>({});
  const [issueType, setIssueType] = useState<Record<string, IssueType>>({});
  const [issueNote, setIssueNote] = useState<Record<string, string>>({});

  async function updateStatus(deliveryId: string, status: DeliveryStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, changedBy: driverName }),
      });
      if (!res.ok) throw new Error("Failed to update.");
      setFeedback((prev) => ({ ...prev, [deliveryId]: `✓ ${STATUS_LABEL[status]}` }));
      router.refresh();
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        [deliveryId]: err instanceof Error ? err.message : "Error",
      }));
    } finally {
      setBusy(false);
    }
  }

  async function submitIssue(deliveryId: string) {
    setBusy(true);
    try {
      const type = issueType[deliveryId] ?? IssueType.delayed;
      const note = issueNote[deliveryId] ?? "";
      const res = await fetch(`/api/deliveries/${deliveryId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueType: type, note: note || null, reportedBy: driverName }),
      });
      if (!res.ok) throw new Error("Failed to report issue.");
      setShowIssueForm((prev) => ({ ...prev, [deliveryId]: false }));
      setFeedback((prev) => ({ ...prev, [deliveryId]: "Issue reported to dispatcher." }));
      router.refresh();
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        [deliveryId]: err instanceof Error ? err.message : "Error",
      }));
    } finally {
      setBusy(false);
    }
  }

  const activeDeliveries = deliveries.filter(
    (d) => d.status !== DeliveryStatus.delivered && d.status !== DeliveryStatus.cancelled
  );
  const completedDeliveries = deliveries.filter(
    (d) => d.status === DeliveryStatus.delivered || d.status === DeliveryStatus.cancelled
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Driver</p>
        <p className="mt-0.5 text-xl font-bold text-slate-900">{driverName}</p>
        <p className="text-sm text-slate-500">
          {activeDeliveries.length} active · {completedDeliveries.length} completed
        </p>
      </div>

      {activeDeliveries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-medium text-slate-600">No active deliveries</p>
          <p className="mt-1 text-sm text-slate-400">Check back with your dispatcher.</p>
        </div>
      ) : null}

      {activeDeliveries.map((d, idx) => {
        const isOpen = openId === d.id;
        const availableActions = STATUS_ACTIONS.filter((a) => a.applicableFrom.includes(d.status));
        const fb = feedback[d.id];
        const showIssue = showIssueForm[d.id] ?? false;

        return (
          <div
            key={d.id}
            className={`rounded-xl border shadow-sm overflow-hidden ${
              d.status === DeliveryStatus.issue_reported
                ? "border-rose-300 bg-rose-50"
                : d.priorityLevel === "urgent"
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200 bg-white"
            }`}
          >
            {/* Stop header — always visible */}
            <button
              className="flex w-full items-center gap-3 px-4 py-4 text-left"
              onClick={() => setOpenId(isOpen ? null : d.id)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {d.customer?.companyName ?? d.deliveryAddress.slice(0, 30)}
                </p>
                <p className="truncate text-sm text-slate-500">{d.deliveryAddress}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[d.status]}`}>
                  {STATUS_LABEL[d.status]}
                </span>
                {d.priorityLevel === "urgent" ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                    URGENT
                  </span>
                ) : null}
              </div>
            </button>

            {/* Expanded */}
            {isOpen ? (
              <div className="border-t border-slate-200 px-4 pb-5 pt-4 space-y-4">
                {/* Addresses */}
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">Pickup</p>
                    <p className="text-slate-700">{d.pickupAddress}</p>
                    {d.pickupContactName ? (
                      <div className="mt-2">
                        <p className="text-slate-600">{d.pickupContactName}</p>
                        {d.pickupContactPhone ? (
                          <a href={`tel:${d.pickupContactPhone}`} className="text-blue-700 underline text-sm font-medium">
                            {d.pickupContactPhone}
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">Deliver To</p>
                    <p className="text-slate-700">{d.deliveryAddress}</p>
                    {d.deliveryContactName ? (
                      <div className="mt-2">
                        <p className="text-slate-600">{d.deliveryContactName}</p>
                        {d.deliveryContactPhone ? (
                          <a href={`tel:${d.deliveryContactPhone}`} className="text-blue-700 underline text-sm font-medium">
                            {d.deliveryContactPhone}
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {d.packageNotes ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
                    <p className="font-bold text-amber-700 mb-0.5">Instructions</p>
                    {d.packageNotes}
                  </div>
                ) : null}

                <p className="text-xs text-slate-400">
                  Requested by: <strong>{new Date(d.requestedDeliveryDateTime).toLocaleString()}</strong>
                </p>

                {fb ? (
                  <p className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
                    fb.startsWith("✓")
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                      : "bg-rose-50 border border-rose-200 text-rose-700"
                  }`}>
                    {fb}
                  </p>
                ) : null}

                {/* Primary action buttons */}
                {availableActions.length > 0 ? (
                  <div className="space-y-2.5">
                    {availableActions.map((action) => (
                      <button
                        key={action.status}
                        disabled={busy}
                        onClick={() => updateStatus(d.id, action.status)}
                        className={`w-full rounded-xl px-4 py-4 text-base font-bold text-white transition-colors disabled:opacity-50 ${action.color}`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Issue reporting */}
                {d.status !== DeliveryStatus.issue_reported ? (
                  !showIssue ? (
                    <button
                      onClick={() => setShowIssueForm((prev) => ({ ...prev, [d.id]: true }))}
                      className="w-full rounded-xl border-2 border-rose-200 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Report Issue / Delay
                    </button>
                  ) : (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3">
                      <p className="text-sm font-bold text-rose-700">Report Issue</p>
                      <select
                        value={issueType[d.id] ?? "delayed"}
                        onChange={(e) => setIssueType((prev) => ({ ...prev, [d.id]: e.target.value as IssueType }))}
                        className="w-full rounded-lg border border-rose-300 px-3 py-3 text-sm bg-white"
                      >
                        {Object.entries(ISSUE_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      <textarea
                        value={issueNote[d.id] ?? ""}
                        onChange={(e) => setIssueNote((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        rows={2}
                        placeholder="Additional details (optional)..."
                        className="w-full rounded-lg border border-rose-300 px-3 py-2 text-sm bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitIssue(d.id)}
                          disabled={busy}
                          className="flex-1 rounded-xl bg-rose-600 py-3.5 text-base font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {busy ? "Sending…" : "Submit Issue"}
                        </button>
                        <button
                          onClick={() => setShowIssueForm((prev) => ({ ...prev, [d.id]: false }))}
                          className="rounded-xl border border-slate-300 px-4 py-3.5 text-sm font-medium text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="rounded-xl bg-rose-100 border border-rose-300 px-3 py-2.5 text-sm font-medium text-rose-700">
                    Issue reported — dispatcher has been notified.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Completed */}
      {completedDeliveries.length > 0 ? (
        <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-500">
            Completed ({completedDeliveries.length})
          </summary>
          <ul className="divide-y divide-slate-100 px-4 pb-3">
            {completedDeliveries.map((d) => (
              <li key={d.id} className="py-2.5 text-sm">
                <span className="font-medium text-slate-700">
                  {d.customer?.companyName ?? d.deliveryAddress.slice(0, 30)}
                </span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[d.status]}`}>
                  {STATUS_LABEL[d.status]}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
