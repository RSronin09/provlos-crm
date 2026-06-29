"use client";

import { useState } from "react";
import { DecisionMakerSearch } from "@/components/crm/decision-maker-search";
import { BulkDiscovery } from "@/components/crm/bulk-discovery";

type Tab = "decision-makers" | "bulk";

export default function DiscoveryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("decision-makers");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Lead Discovery</h2>
        <p className="text-sm text-slate-600 mt-1">
          Find decision makers at target companies or run bulk company discovery from web signals.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200">
        {(
          [
            { id: "decision-makers", label: "Decision Maker Search" },
            { id: "bulk", label: "Bulk Company Discovery" },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "decision-makers" ? (
        <DecisionMakerSearch />
      ) : (
        <BulkDiscovery />
      )}
    </div>
  );
}
