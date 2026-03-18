import { DeliveryStatus } from "@prisma/client";

type DeliveryStatusBadgeProps = {
  status: DeliveryStatus;
};

const colorMap: Record<DeliveryStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  en_route_to_pickup: "bg-indigo-50 text-indigo-700 border-indigo-200",
  picked_up: "bg-violet-50 text-violet-700 border-violet-200",
  en_route_to_delivery: "bg-amber-50 text-amber-700 border-amber-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  issue_reported: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const labelMap: Record<DeliveryStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  en_route_to_pickup: "En Route to Pickup",
  picked_up: "Picked Up",
  en_route_to_delivery: "En Route to Delivery",
  delivered: "Delivered",
  issue_reported: "Issue Reported",
  cancelled: "Cancelled",
};

export function DeliveryStatusBadge({ status }: DeliveryStatusBadgeProps) {
  const cls = colorMap[status] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {labelMap[status] ?? status}
    </span>
  );
}
