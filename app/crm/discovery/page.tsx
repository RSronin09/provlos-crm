"use client";

import { useState } from "react";
import { DecisionMakerSearch } from "@/components/crm/decision-maker-search";
import { BulkDiscovery } from "@/components/crm/bulk-discovery";
import { SpreadsheetImport } from "@/components/crm/spreadsheet-import";
import { InstantlySearchPanel } from "@/components/crm/instantly-search-panel";

type Tab = "search" | "bulk" | "spreadsheet" | "instantly";

const TABS: { id: Tab; label: string; description: string }[] = [
  {
    id: "search",
    label: "Decision Maker Search",
    description: "Look up decision makers at any company using Serper and Hunter.io.",
  },
  {
    id: "bulk",
    label: "Bulk Company Discovery",
    description: "Run batch discovery to find net-new companies from web signals.",
  },
  {
    id: "spreadsheet",
    label: "Spreadsheet Import",
    description: "Upload an Excel or CSV file to bulk-import and enrich leads.",
  },
  {
    id: "instantly",
    label: "Instantly Lead Finder",
    description: "Search Instantly's verified B2B database by industry, title, and location, then import to the CRM.",
  },
];

export default function DiscoveryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("search");

  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Lead Discovery</h2>
        <p className="text-sm text-slate-600 mt-1">
          Find decision makers, run bulk discovery, or import leads from a spreadsheet.
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
      {activeTab === "bulk" && <BulkDiscovery />}
      {activeTab === "spreadsheet" && <SpreadsheetImport />}
      {activeTab === "instantly" && <InstantlySearchPanel />}
    </div>
  );
}
