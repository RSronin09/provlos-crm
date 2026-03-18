import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/crm/ui/page-header";
import { DeliveryEditForm } from "@/components/crm/delivery-edit-form";
import Link from "next/link";

type EditDeliveryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDeliveryPage({ params }: EditDeliveryPageProps) {
  const { id } = await params;

  const [delivery, accounts, drivers] = await Promise.all([
    db.delivery.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        pickupAddress: true,
        deliveryAddress: true,
        requestedDeliveryDateTime: true,
        pickupDateTime: true,
        pickupContactName: true,
        pickupContactPhone: true,
        deliveryContactName: true,
        deliveryContactPhone: true,
        packageNotes: true,
        priorityLevel: true,
        assignedDriverId: true,
        status: true,
      },
    }),
    db.account.findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    db.driver.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!delivery) notFound();

  const shortId = delivery.id.slice(0, 8).toUpperCase();

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Edit Delivery #${shortId}`}
        subtitle="Update addresses, scheduling, contacts, priority, or driver assignment."
        actions={
          <Link
            href={`/crm/deliveries/${id}`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to Detail
          </Link>
        }
      />

      <DeliveryEditForm
        initialValues={{
          id: delivery.id,
          customerId: delivery.customerId,
          pickupAddress: delivery.pickupAddress,
          deliveryAddress: delivery.deliveryAddress,
          requestedDeliveryDateTime: delivery.requestedDeliveryDateTime.toISOString(),
          pickupDateTime: delivery.pickupDateTime?.toISOString() ?? null,
          pickupContactName: delivery.pickupContactName,
          pickupContactPhone: delivery.pickupContactPhone,
          deliveryContactName: delivery.deliveryContactName,
          deliveryContactPhone: delivery.deliveryContactPhone,
          packageNotes: delivery.packageNotes,
          priorityLevel: delivery.priorityLevel,
          assignedDriverId: delivery.assignedDriverId,
        }}
        accounts={accounts}
        drivers={drivers}
      />
    </div>
  );
}
