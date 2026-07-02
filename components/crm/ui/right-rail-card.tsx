import { ReactNode } from "react";

type RightRailCardProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function RightRailCard({ title, action, children }: RightRailCardProps) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
        {action}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
