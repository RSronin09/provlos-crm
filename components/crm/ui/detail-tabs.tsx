type DetailTab = {
  id: string;
  label: string;
};

type DetailTabsProps = {
  tabs: DetailTab[];
};

export function DetailTabs({ tabs }: DetailTabsProps) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <div className="flex gap-2 border-b border-slate-200 pb-3 px-1">
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            className="flex-shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm whitespace-nowrap hover:bg-slate-50 active:bg-slate-100 min-h-[40px] flex items-center"
          >
            {tab.label}
          </a>
        ))}
      </div>
    </div>
  );
}
