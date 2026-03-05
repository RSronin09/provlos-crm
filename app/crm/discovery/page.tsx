import { DecisionMakerSearch } from "@/components/crm/decision-maker-search";

export default function DiscoveryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Decision Maker Search</h2>
        <p className="text-sm text-slate-600">
          Enter a company name, hit search, and return likely decision makers with name, phone, and email.
        </p>
      </div>
      <DecisionMakerSearch />
    </div>
  );
}
