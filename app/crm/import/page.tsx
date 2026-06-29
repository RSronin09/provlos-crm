import { SpreadsheetImport } from "@/components/crm/spreadsheet-import";
import { PageHeader } from "@/components/crm/ui/page-header";
import Link from "next/link";

export default function ImportTargetsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Leads"
        subtitle="Upload an Excel or CSV file to bulk-import companies and contacts, then enrich them with decision-maker data."
        actions={
          <Link
            href="/crm/discovery"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ← Lead Discovery
          </Link>
        }
      />
      <SpreadsheetImport />
    </div>
  );
}
