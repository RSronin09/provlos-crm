type StatusBadgeProps = {
  value: string;
};

const colorMap: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  DONE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SNOOZED: "bg-slate-100 text-slate-700 border-slate-200",
  QUEUED: "bg-blue-50 text-blue-700 border-blue-200",
  RUNNING: "bg-indigo-50 text-indigo-700 border-indigo-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
  ENRICHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NOT_STARTED: "bg-slate-100 text-slate-700 border-slate-200",
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const cls = colorMap[value] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{value}</span>;
}
