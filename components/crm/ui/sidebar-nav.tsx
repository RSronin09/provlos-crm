import Link from "next/link";

export type SidebarNavItem = {
  href: string;
  label: string;
  isSection?: boolean;
};

type SidebarNavProps = {
  items: SidebarNavItem[];
};

export function SidebarNav({ items }: SidebarNavProps) {
  return (
    <nav className="space-y-1">
      {items.map((item, idx) =>
        item.isSection ? (
          <p
            key={`section-${idx}`}
            className="mt-3 mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400"
          >
            Deliveries
          </p>
        ) : (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            {item.label}
          </Link>
        )
      )}
    </nav>
  );
}
