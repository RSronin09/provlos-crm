"use client";

import { useState } from "react";
import { DecisionMakerSearch } from "@/components/crm/decision-maker-search";
import { SpreadsheetImport } from "@/components/crm/spreadsheet-import";

type Tab = "search" | "spreadsheet";

const TABS: { id: Tab; label: string; description: string }[] = [
  {
    id: "search",
    label: "Decision Maker Search",
    description: "Look up decision makers at any company using Serper and Hunter.io.",
  },
  {
    id: "spreadsheet",
    label: "Spreadsheet Import",
    description: "Upload an Excel or CSV file to bulk-import and enrich leads.",
  },
];

export default function DiscoveryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("search");

  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Lead Discovery</h2>
        <p className="text-sm text-slate-600">
          Discover net-new companies and decision makers, then add them directly into CRM as target accounts.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] whitespace-nowrap px-4 pb-3 pt-2 text-sm font-medium transition border-b-2 ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <p className="text-xs text-slate-500 -mt-2">{active.description}</p>

      {activeTab === "search" && <DecisionMakerSearch />}
      {activeTab === "spreadsheet" && <SpreadsheetImport />}
    </div>
  );
}
