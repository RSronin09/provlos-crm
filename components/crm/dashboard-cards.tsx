"use client";

import { useMemo, useState } from "react";

type DashboardCard = {
  id: string;
  label: string;
  value: number;
  items: string[];
  emptyMessage: string;
};

type DashboardCardsProps = {
  cards: DashboardCard[];
};

export function DashboardCards({ cards }: DashboardCardsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeCard = useMemo(
    () => cards.find((card) => card.id === activeId) ?? null,
    [activeId, cards],
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setActiveId(card.id)}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100"
          >
            <div className="text-sm text-slate-600">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold">{card.value}</div>
            <p className="mt-2 text-xs text-slate-500">Click to view details</p>
          </button>
        ))}
      </div>

      {activeCard ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setActiveId(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-xl overflow-auto rounded-lg bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{activeCard.label}</h3>
                <p className="text-sm text-slate-600">{activeCard.value} total</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>

            {activeCard.items.length ? (
              <ul className="space-y-2 text-sm">
                {activeCard.items.map((item, index) => (
                  <li key={`${activeCard.id}-${index}`} className="rounded-md border border-slate-200 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{activeCard.emptyMessage}</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
