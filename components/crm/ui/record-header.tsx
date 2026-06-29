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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-600 [overflow-wrap:break-word]">{subtitle}</p>
          ) : null}
          {badges ? <div className="mt-2 flex flex-wrap gap-2">{badges}</div> : null}
        </div>
        {actions ? (
          <div className="flex flex-shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
