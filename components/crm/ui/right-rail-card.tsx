import { ReactNode } from "react";

type RightRailCardProps = {
  title: string;
  children: ReactNode;
};

export function RightRailCard({ title, children }: RightRailCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
      {children}
    </section>
  );
}
