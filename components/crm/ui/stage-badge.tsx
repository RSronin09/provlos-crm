type StageBadgeProps = {
  stage: string;
};

const stageColorMap: Record<string, string> = {
  TARGET: "bg-slate-100 text-slate-700 border-slate-200",
  ENRICHING: "bg-blue-50 text-blue-700 border-blue-200",
  ENRICHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CONTACTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ENGAGED: "bg-purple-50 text-purple-700 border-purple-200",
  QUALIFIED: "bg-cyan-50 text-cyan-700 border-cyan-200",
  PROPOSAL: "bg-amber-50 text-amber-700 border-amber-200",
  WON: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOST: "bg-rose-50 text-rose-700 border-rose-200",
};

export function StageBadge({ stage }: StageBadgeProps) {
  const cls = stageColorMap[stage] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{stage}</span>;
}
