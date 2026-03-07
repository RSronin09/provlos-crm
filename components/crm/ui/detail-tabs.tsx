type DetailTab = {
  id: string;
  label: string;
};

type DetailTabsProps = {
  tabs: DetailTab[];
};

export function DetailTabs({ tabs }: DetailTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={`#${tab.id}`}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}
