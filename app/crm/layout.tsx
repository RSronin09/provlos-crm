import { AppShell } from "@/components/crm/ui/app-shell";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/crm/dashboard", label: "Dashboard" },
  // Relationships section
  { href: "/crm/relationships", label: "Relationships", isSection: true },
  { href: "/crm/relationships", label: "All Relationships" },
  { href: "/crm/relationships/customers", label: "Customers" },
  { href: "/crm/relationships/vendors", label: "Vendors" },
  { href: "/crm/relationships/banks", label: "Banks & Lenders" },
  { href: "/crm/relationships/suppliers", label: "Suppliers" },
  { href: "/crm/relationships/partners", label: "Partners" },
  // CRM tools
  { href: "/crm/contacts", label: "CRM", isSection: true },
  { href: "/crm/contacts", label: "Contacts" },
  { href: "/crm/pipeline", label: "Pipeline" },
  { href: "/crm/tasks", label: "Tasks" },
  { href: "/crm/discovery", label: "Lead Discovery" },
  // Deliveries section
  { href: "/crm/deliveries", label: "Deliveries", isSection: true },
  { href: "/crm/deliveries", label: "Delivery Dashboard" },
  { href: "/crm/deliveries/dispatch", label: "Dispatch Board" },
  { href: "/crm/deliveries/live", label: "Live Operations" },
  { href: "/crm/deliveries/all", label: "All Deliveries" },
  { href: "/crm/deliveries/create", label: "Create Delivery" },
  { href: "/crm/deliveries/drivers", label: "Drivers" },
  { href: "/crm/deliveries/driver-view", label: "Driver View" },
];

export default function CrmLayout({ children }: { children: ReactNode }) {
  return <AppShell navItems={navItems}>{children}</AppShell>;
}
