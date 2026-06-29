"use client";

import { useEffect, useState } from "react";
import { SidebarNav, SidebarNavItem } from "./sidebar-nav";

type AppShellProps = {
  navItems: SidebarNavItem[];
  children: React.ReactNode;
};

export function AppShell({ navItems, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* ── Top bar (sticky, full-width) ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              aria-label="Open navigation"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 active:bg-slate-200 md:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-wide text-slate-800">ProvLOS CRM</span>
            </div>
          </div>
          <div className="hidden text-xs text-slate-500 md:block">Prospecting Workspace</div>
        </div>
      </header>

      {/* ── Mobile drawer backdrop ── */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity duration-200 md:hidden ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ── Mobile drawer (slides in from the left) ── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-200 md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-900">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-800">ProvLOS CRM</span>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            onClick={() => setDrawerOpen(false)}
          >
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Drawer nav */}
        <div className="flex-1 overflow-y-auto p-3 pb-safe">
          <SidebarNav items={navItems} onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      {/* ── Main layout (sidebar + content) ── */}
      <div className="mx-auto grid max-w-[1400px] gap-6 p-4 md:grid-cols-[240px_1fr] md:p-6">
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="hidden self-start rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:block md:sticky md:top-[4.5rem]">
          <SidebarNav items={navItems} />
        </aside>

        {/* Main content — min-w-0 prevents grid blowout on small content */}
        <main className="min-w-0 space-y-6 pb-safe">{children}</main>
      </div>
    </div>
  );
}
