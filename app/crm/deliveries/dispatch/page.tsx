import { db } from "@/lib/db";
import {
  getDriverWorkload,
  getDispatchQueueOrder,
  computeDeliveryPriorityScore,
  isOverdue,
  isAtRisk,
  TERMINAL_STATUSES,
} from "@/lib/delivery-queue";
import { DispatchWorkbench } from "@/components/crm/dispatch-workbench";
import { PageHeader } from "@/components/crm/ui/page-header";
import { IssueStatus } from "@prisma/client";
import Link from "next/link";

export default async function DispatchBoardPage() {
  const [rawQueue, driverWorkload] = await Promise.all([
    db.delivery.findMany({
      where: { status: { notIn: TERMINAL_STATUSES } },
      include: {
        customer: { select: { id: true, companyName: true } },
        assignedDriver: { select: { id: true, name: true } },
        issues: { where: { status: IssueStatus.open }, select: { id: true } },
      },
      orderBy: [{ priorityLevel: "desc" }, { requestedDeliveryDateTime: "asc" }],
    }),
    getDriverWorkload(),
  ]);

  const sorted = getDispatchQueueOrder(rawQueue);

  const queue = sorted.map((d) => ({
    id: d.id,
    status: d.status,
    priorityLevel: d.priorityLevel,
    pickupAddress: d.pickupAddress,
    deliveryAddress: d.deliveryAddress,
    requestedDeliveryDateTime: d.requestedDeliveryDateTime.toISOString(),
    assignedDriverId: d.assignedDriverId,
    dispatcherNotes: d.dispatcherNotes,
    priorityScore: computeDeliveryPriorityScore(d),
    isOverdue: isOverdue(d),
    isAtRisk: isAtRisk(d, 2),
    hasOpenIssue: d.issues.length > 0,
    customer: d.customer,
    assignedDriver: d.assignedDriver,
  }));

  const drivers = driverWorkload.map((d) => ({
    id: d.id,
    name: d.name,
    openDeliveries: d.openDeliveries,
    load: d.load,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dispatch Board"
        subtitle="Manage the full delivery queue and driver assignments from one place."
        actions={
          <div className="flex gap-2">
            <Link
              href="/crm/deliveries"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Dashboard
            </Link>
            <Link
              href="/crm/deliveries/create"
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              + New Delivery
            </Link>
          </div>
        }
      />
      <DispatchWorkbench queue={queue} drivers={drivers} />
    </div>
  );
}
