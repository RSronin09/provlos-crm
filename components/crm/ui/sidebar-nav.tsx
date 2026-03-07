import Link from "next/link";

export type SidebarNavItem = {
  href: string;
  label: string;
};

type SidebarNavProps = {
  items: SidebarNavItem[];
};

export function SidebarNav({ items }: SidebarNavProps) {
  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
