import { redirect } from "next/navigation";

// Spreadsheet import now lives as a tab inside Lead Discovery so there is a
// single entry point for bringing new companies into the CRM.
export default function ImportTargetsPage() {
  redirect("/crm/discovery?tab=spreadsheet");
}
