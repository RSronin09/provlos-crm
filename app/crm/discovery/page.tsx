import { DecisionMakerSearch } from "@/components/crm/decision-maker-search";

export default function DiscoveryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Lead Discovery</h2>
        <p className="text-sm text-slate-600">
          Discover net-new companies and decision makers, then add them directly into CRM as target accounts.
        </p>
      </div>
      <DecisionMakerSearch />
    </div>
  );
}
