import { AddRelationshipForm } from "@/components/crm/add-relationship-form";
import { PageHeader } from "@/components/crm/ui/page-header";
import Link from "next/link";

export default function NewRelationshipPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Relationship"
        subtitle="Create a new customer, vendor, bank, supplier, partner, or other relationship record."
        actions={
          <Link href="/crm/relationships" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            Back
          </Link>
        }
      />
      <AddRelationshipForm />
    </div>
  );
}
