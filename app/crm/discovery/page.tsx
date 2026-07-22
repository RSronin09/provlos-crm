"use client";

import { useState } from "react";
import { InstantlySearchPanel } from "@/components/crm/instantly-search-panel";
import { RegistrySearchPanel } from "@/components/crm/registry-search-panel";

type Tab = "registry" | "instantly";

const TABS: { id: Tab; label: string; description: string }[] = [
  {
    id: "registry",
    label: "Healthcare Registry",
    description:
      "Pull every licensed healthcare facility in your target counties from the free government NPI registry — with decision-maker names, titles, and phones included.",
  },
  {
    id: "instantly",
    label: "Instantly Lead Finder",
    description: "Search Instantly's verified B2B database by industry, title, and location, then import to the CRM.",
  },
];

export default function DiscoveryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("registry");

  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Lead Discovery</h2>
        <p className="text-sm text-slate-600 mt-1">
          Pull facilities from the government registry or search Instantly&apos;s verified database.
          Spreadsheet uploads live under Import.
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

      {activeTab === "registry" && <RegistrySearchPanel />}
      {activeTab === "instantly" && <InstantlySearchPanel />}
    </div>
  );
}
