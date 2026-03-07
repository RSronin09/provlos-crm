import { ReactNode } from "react";
import { SidebarNav, SidebarNavItem } from "./sidebar-nav";

type AppShellProps = {
  navItems: SidebarNavItem[];
  children: ReactNode;
};

export function AppShell({ navItems, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <div className="text-sm font-semibold tracking-wide text-slate-700">ProvLOS CRM</div>
          <div className="text-xs text-slate-500">Prospecting Workspace</div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 p-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <SidebarNav items={navItems} />
        </aside>
        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
}
