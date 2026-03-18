import { db } from "@/lib/db";
import { suggestDriver } from "@/lib/delivery-queue";
import { DeliveryCreateForm } from "@/components/crm/delivery-create-form";
import { PageHeader } from "@/components/crm/ui/page-header";
import Link from "next/link";

export default async function CreateDeliveryPage() {
  const [accounts, drivers, suggestedDriverId] = await Promise.all([
    db.account.findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
      take: 500,
    }),
    db.driver.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    suggestDriver(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Delivery"
        subtitle="Add a new delivery request to the dispatch queue."
        actions={
          <Link
            href="/crm/deliveries/all"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to Deliveries
          </Link>
        }
      />
      <DeliveryCreateForm
        accounts={accounts}
        drivers={drivers}
        suggestedDriverId={suggestedDriverId}
      />
    </div>
  );
}
