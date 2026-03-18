import { DeliveryPriority } from "@prisma/client";

type PriorityBadgeProps = {
  priority: DeliveryPriority;
};

const colorMap: Record<DeliveryPriority, string> = {
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
  standard: "bg-slate-100 text-slate-600 border-slate-200",
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const cls = colorMap[priority] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}
