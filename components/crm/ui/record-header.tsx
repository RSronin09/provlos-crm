import { ReactNode } from "react";

type RecordHeaderProps = {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  actions?: ReactNode;
};

export function RecordHeader({ title, subtitle, badges, actions }: RecordHeaderProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          {badges ? <div className="mt-2 flex flex-wrap gap-2">{badges}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
