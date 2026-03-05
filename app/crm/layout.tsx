import Link from "next/link";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/crm", label: "Dashboard" },
  { href: "/crm/accounts", label: "Accounts" },
  { href: "/crm/tasks", label: "Tasks" },
  { href: "/crm/import", label: "Import Targets" },
  { href: "/crm/settings", label: "Settings" },
];

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          <h1 className="mb-4 text-lg font-semibold">ProvLOS CRM</h1>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="rounded-lg border border-slate-200 bg-white p-6">{children}</main>
      </div>
    </div>
  );
}
