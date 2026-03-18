import { DeliveryStatus } from "@prisma/client";

type HistoryEntry = {
  id: string;
  oldStatus: DeliveryStatus | null;
  newStatus: DeliveryStatus;
  changedBy: string;
  changedAt: Date | string;
  note: string | null;
};

type PhaseTimestamps = {
  createdAt: Date | string;
  assignedAt: Date | string | null;
  pickedUpAt: Date | string | null;
  deliveredAt: Date | string | null;
  cancelledAt: Date | string | null;
};

type DeliveryTimelineProps = {
  history: HistoryEntry[];
  phases: PhaseTimestamps;
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

const STATUS_DOT: Record<DeliveryStatus, string> = {
  pending: "bg-slate-400",
  assigned: "bg-blue-500",
  en_route_to_pickup: "bg-indigo-500",
  picked_up: "bg-violet-500",
  en_route_to_delivery: "bg-amber-500",
  delivered: "bg-emerald-500",
  issue_reported: "bg-rose-500",
  cancelled: "bg-slate-300",
};

function fmt(dt: Date | string | null): string {
  if (!dt) return "";
  const d = typeof dt === "string" ? new Date(dt) : dt;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function DeliveryTimeline({ history, phases }: DeliveryTimelineProps) {
  return (
    <div className="space-y-0">
      {/* Phase summary row */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
        {[
          { label: "Created", value: fmt(phases.createdAt) },
          { label: "Assigned", value: fmt(phases.assignedAt) },
          { label: "Picked Up", value: fmt(phases.pickedUpAt) },
          { label: phases.cancelledAt ? "Cancelled" : "Delivered", value: fmt(phases.cancelledAt ?? phases.deliveredAt) },
        ].map((p) => (
          <div key={p.label} className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-2">
            <p className="font-semibold uppercase tracking-wide text-slate-400">{p.label}</p>
            <p className="mt-0.5 font-medium text-slate-700">{p.value || "—"}</p>
          </div>
        ))}
      </div>

      {/* Status change feed */}
      {history.length === 0 ? (
        <p className="text-sm text-slate-400">No status history recorded yet.</p>
      ) : (
        <ul className="relative space-y-3 pl-5">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
          {history.map((h) => (
            <li key={h.id} className="relative flex items-start gap-3">
              <span
                className={`absolute -left-[13px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${STATUS_DOT[h.newStatus]}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold text-slate-800">
                    {STATUS_LABEL[h.newStatus]}
                  </span>
                  {h.oldStatus ? (
                    <span className="text-slate-400 text-xs">
                      ← {STATUS_LABEL[h.oldStatus]}
                    </span>
                  ) : null}
                  <span className="text-slate-400 text-xs">by {h.changedBy}</span>
                </div>
                <p className="text-xs text-slate-400">{fmt(h.changedAt)}</p>
                {h.note ? (
                  <p className="mt-0.5 text-xs italic text-slate-500">"{h.note}"</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
