import { AppShell } from "@/components/crm/ui/app-shell";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/crm/dashboard", label: "Dashboard" },
  { href: "/crm/accounts", label: "Accounts" },
  { href: "/crm/contacts", label: "Contacts" },
  { href: "/crm/pipeline", label: "Pipeline" },
  { href: "/crm/tasks", label: "Tasks" },
  { href: "/crm/discovery", label: "Lead Discovery" },
  { href: "/crm/import", label: "Import Targets" },
  { href: "/crm/settings", label: "Settings" },
];

export default function CrmLayout({ children }: { children: ReactNode }) {
  return <AppShell navItems={navItems}>{children}</AppShell>;
}
