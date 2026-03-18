"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeliveryStatus } from "@prisma/client";

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
    label: "Picked Up",
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
    label: "Mark Delivered",
    color: "bg-emerald-600 hover:bg-emerald-700",
    applicableFrom: [DeliveryStatus.en_route_to_delivery],
  },
  {
    status: DeliveryStatus.issue_reported,
    label: "Report Issue / Delay",
    color: "bg-rose-600 hover:bg-rose-700",
    applicableFrom: [
      DeliveryStatus.assigned,
      DeliveryStatus.en_route_to_pickup,
      DeliveryStatus.picked_up,
      DeliveryStatus.en_route_to_delivery,
    ],
  },
];

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

  async function updateStatus(deliveryId: string, status: DeliveryStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, changedBy: driverName }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error ?? "Failed");
      }
      setFeedback((prev) => ({ ...prev, [deliveryId]: `Updated to: ${STATUS_LABEL[status]}` }));
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
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Driver</p>
        <p className="mt-0.5 text-lg font-bold text-slate-900">{driverName}</p>
        <p className="text-sm text-slate-500">
          {activeDeliveries.length} active · {completedDeliveries.length} completed today
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

        return (
          <div
            key={d.id}
            className={`rounded-xl border shadow-sm overflow-hidden ${
              d.priorityLevel === "urgent"
                ? "border-rose-300 bg-rose-50"
                : "border-slate-200 bg-white"
            }`}
          >
            {/* Stop header */}
            <button
              className="flex w-full items-center gap-3 px-4 py-4 text-left"
              onClick={() => setOpenId(isOpen ? null : d.id)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {d.customer?.companyName ?? d.deliveryAddress.slice(0, 30)}
                </p>
                <p className="truncate text-sm text-slate-500">{d.deliveryAddress}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[d.status]}`}
              >
                {STATUS_LABEL[d.status]}
              </span>
            </button>

            {/* Expanded detail */}
            {isOpen ? (
              <div className="border-t border-slate-200 px-4 py-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-1">Pickup</p>
                    <p className="text-slate-700">{d.pickupAddress}</p>
                    {d.pickupContactName ? (
                      <p className="mt-1 text-slate-500">
                        {d.pickupContactName}
                        {d.pickupContactPhone ? (
                          <>
                            {" · "}
                            <a
                              href={`tel:${d.pickupContactPhone}`}
                              className="text-blue-700 underline"
                            >
                              {d.pickupContactPhone}
                            </a>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-1">Delivery</p>
                    <p className="text-slate-700">{d.deliveryAddress}</p>
                    {d.deliveryContactName ? (
                      <p className="mt-1 text-slate-500">
                        {d.deliveryContactName}
                        {d.deliveryContactPhone ? (
                          <>
                            {" · "}
                            <a
                              href={`tel:${d.deliveryContactPhone}`}
                              className="text-blue-700 underline"
                            >
                              {d.deliveryContactPhone}
                            </a>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </div>

                {d.packageNotes ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    <span className="font-semibold">Notes: </span>{d.packageNotes}
                  </div>
                ) : null}

                <div className="text-xs text-slate-400">
                  Requested by: {new Date(d.requestedDeliveryDateTime).toLocaleString()}
                </div>

                {fb ? (
                  <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700">
                    {fb}
                  </p>
                ) : null}

                {/* Action buttons */}
                {availableActions.length > 0 ? (
                  <div className="space-y-2">
                    {availableActions.map((action) => (
                      <button
                        key={action.status}
                        disabled={busy}
                        onClick={() => updateStatus(d.id, action.status)}
                        className={`w-full rounded-xl px-4 py-4 text-base font-semibold text-white transition-colors disabled:opacity-50 ${action.color}`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-slate-400">No actions available for current status.</p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {completedDeliveries.length > 0 ? (
        <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-500">
            Completed ({completedDeliveries.length})
          </summary>
          <ul className="divide-y divide-slate-100 px-4 pb-3">
            {completedDeliveries.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                <span className="font-medium text-slate-700">
                  {d.customer?.companyName ?? d.deliveryAddress.slice(0, 30)}
                </span>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[d.status]}`}
                >
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
