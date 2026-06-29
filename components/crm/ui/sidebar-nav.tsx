"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export type SidebarNavItem = {
  href: string;
  label: string;
  isSection?: boolean;
  icon?: ReactNode;
};

type SidebarNavProps = {
  items: SidebarNavItem[];
  onNavigate?: () => void;
};

export function SidebarNav({ items, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {items.map((item, idx) =>
        item.isSection ? (
          <p
            key={`section-${idx}`}
            className="mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400"
          >
            {item.label}
          </p>
        ) : (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={onNavigate}
            className={`flex min-h-[44px] items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              pathname === item.href
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100 active:bg-slate-200"
            }`}
          >
            {item.icon ? (
              <span className="flex-shrink-0 opacity-70">{item.icon}</span>
            ) : null}
            <span>{item.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
