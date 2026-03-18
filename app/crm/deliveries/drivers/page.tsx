import { db } from "@/lib/db";
import { PageHeader } from "@/components/crm/ui/page-header";
import { DriversPanel } from "@/components/crm/drivers-panel";
import Link from "next/link";

export default async function DriversPage() {
  const drivers = await db.driver.findMany({
    include: {
      _count: {
        select: {
          deliveries: {
            where: {
              status: {
                in: ["assigned", "en_route_to_pickup", "picked_up", "en_route_to_delivery"],
              },
            },
          },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        subtitle="Manage your driver roster and availability."
        actions={
          <Link
            href="/crm/deliveries"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Delivery Dashboard
          </Link>
        }
      />
      <DriversPanel drivers={drivers} />
    </div>
  );
}
