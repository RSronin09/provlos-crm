import { db } from "@/lib/db";
import { DeliveryPriority, DeliveryStatus } from "@prisma/client";

/** Statuses that count as "open/active" for driver workload calculation */
const OPEN_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.assigned,
  DeliveryStatus.en_route_to_pickup,
  DeliveryStatus.picked_up,
  DeliveryStatus.en_route_to_delivery,
];

/**
 * Suggest the best active driver to assign based on fewest open deliveries.
 * Returns null if no active drivers exist.
 */
export async function suggestDriver(): Promise<string | null> {
  const drivers = await db.driver.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          deliveries: {
            where: { status: { in: OPEN_STATUSES } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  if (drivers.length === 0) return null;

  // Sort by open delivery count ascending — pick driver with fewest
  const sorted = drivers.sort((a, b) => a._count.deliveries - b._count.deliveries);
  return sorted[0].id;
}

/**
 * Sort deliveries using MVP queue logic:
 *   1. urgent before standard
 *   2. within same priority: earliest requestedDeliveryDateTime first
 *
 * This is intentionally simple and modular — replace with route optimization later.
 */
export function sortDeliveryQueue<
  T extends { priorityLevel: DeliveryPriority; requestedDeliveryDateTime: Date }
>(deliveries: T[]): T[] {
  return [...deliveries].sort((a, b) => {
    if (a.priorityLevel !== b.priorityLevel) {
      return a.priorityLevel === DeliveryPriority.urgent ? -1 : 1;
    }
    return a.requestedDeliveryDateTime.getTime() - b.requestedDeliveryDateTime.getTime();
  });
}

/**
 * Get workload summary: each active driver with count of open assigned deliveries.
 */
export async function getDriverWorkload() {
  const drivers = await db.driver.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          deliveries: {
            where: { status: { in: OPEN_STATUSES } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return drivers.map((d) => ({
    id: d.id,
    name: d.name,
    openDeliveries: d._count.deliveries,
  }));
}
