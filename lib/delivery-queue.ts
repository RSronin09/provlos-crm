import { db } from "@/lib/db";
import { DeliveryPriority, DeliveryStatus } from "@prisma/client";

/** Statuses that count as "open/active" for driver workload */
export const OPEN_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.assigned,
  DeliveryStatus.en_route_to_pickup,
  DeliveryStatus.picked_up,
  DeliveryStatus.en_route_to_delivery,
];

/** Statuses considered "in-flight" (moving) */
export const IN_PROGRESS_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.en_route_to_pickup,
  DeliveryStatus.picked_up,
  DeliveryStatus.en_route_to_delivery,
];

/** Terminal statuses */
export const TERMINAL_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.delivered,
  DeliveryStatus.cancelled,
];

/**
 * Compute a deterministic dispatch priority score for a delivery.
 * Higher score = needs attention sooner.
 *
 * Scoring breakdown:
 *   +1000  issue_reported status
 *   +500   urgent priority
 *   +400   overdue (past requestedDeliveryDateTime)
 *   +300   unassigned (no driver)
 *   +200   at-risk (deadline within 2 hours)
 *   +100   deadline within 4 hours
 *   +50    deadline within same day
 *   -time  time distance in hours (smaller = more urgent)
 *
 * Modular: replace this function with a route-optimization score later.
 */
export function computeDeliveryPriorityScore(delivery: {
  priorityLevel: DeliveryPriority;
  status: DeliveryStatus;
  requestedDeliveryDateTime: Date;
  assignedDriverId: string | null;
}): number {
  const now = new Date();
  const diffMs = delivery.requestedDeliveryDateTime.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  let score = 0;

  if (delivery.status === DeliveryStatus.issue_reported) score += 1000;
  if (delivery.priorityLevel === DeliveryPriority.urgent) score += 500;
  if (diffHours < 0) score += 400; // overdue
  if (!delivery.assignedDriverId) score += 300; // unassigned
  if (diffHours >= 0 && diffHours < 2) score += 200; // at-risk
  if (diffHours >= 0 && diffHours < 4) score += 100;
  if (diffHours >= 0 && diffHours < 8) score += 50;

  // Subtract normalized hours so earlier deadlines rank higher within same tier
  // Cap at -200 to avoid dominating categorical scores
  score -= Math.min(Math.max(diffHours, -24), 200);

  return Math.round(score);
}

/**
 * Sort deliveries by computed priority score (highest first).
 * Pure function — no DB calls.
 */
export function getDispatchQueueOrder<
  T extends {
    priorityLevel: DeliveryPriority;
    status: DeliveryStatus;
    requestedDeliveryDateTime: Date;
    assignedDriverId: string | null;
  }
>(deliveries: T[]): T[] {
  return [...deliveries].sort(
    (a, b) =>
      computeDeliveryPriorityScore(b) - computeDeliveryPriorityScore(a)
  );
}

/**
 * Legacy simple sort (urgent-first, then earliest datetime).
 * Kept for driver-view ordering where score-based ranking is less relevant.
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

/** Returns true if a delivery's requested datetime is in the past */
export function isOverdue(delivery: {
  status: DeliveryStatus;
  requestedDeliveryDateTime: Date;
}): boolean {
  if (TERMINAL_STATUSES.includes(delivery.status)) return false;
  return delivery.requestedDeliveryDateTime < new Date();
}

/** Returns true if delivery deadline is within the next N hours */
export function isAtRisk(
  delivery: { status: DeliveryStatus; requestedDeliveryDateTime: Date },
  withinHours = 2
): boolean {
  if (TERMINAL_STATUSES.includes(delivery.status)) return false;
  const now = new Date();
  const diffMs = delivery.requestedDeliveryDateTime.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours < withinHours;
}

/**
 * Suggest the best active driver based on fewest open deliveries.
 */
export async function suggestDriver(): Promise<string | null> {
  const drivers = await db.driver.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          deliveries: { where: { status: { in: OPEN_STATUSES } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  if (drivers.length === 0) return null;
  const sorted = [...drivers].sort((a, b) => a._count.deliveries - b._count.deliveries);
  return sorted[0].id;
}

/**
 * Driver workload summary with load indicator.
 */
export async function getDriverWorkload() {
  const drivers = await db.driver.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          deliveries: { where: { status: { in: OPEN_STATUSES } } },
        },
      },
      deliveries: {
        where: { status: { in: IN_PROGRESS_STATUSES } },
        select: { id: true, status: true, requestedDeliveryDateTime: true },
        orderBy: { requestedDeliveryDateTime: "asc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return drivers.map((d) => {
    const open = d._count.deliveries;
    const load: "low" | "medium" | "high" =
      open === 0 ? "low" : open <= 2 ? "medium" : "high";
    return {
      id: d.id,
      name: d.name,
      openDeliveries: open,
      inProgress: d.deliveries.length > 0,
      nextDeliveryAt: d.deliveries[0]?.requestedDeliveryDateTime ?? null,
      load,
    };
  });
}

/** Count of overdue (non-terminal) deliveries */
export async function getOverdueCount(): Promise<number> {
  return db.delivery.count({
    where: {
      status: { notIn: TERMINAL_STATUSES },
      requestedDeliveryDateTime: { lt: new Date() },
    },
  });
}

/** Count of unassigned non-terminal deliveries */
export async function getUnassignedCount(): Promise<number> {
  return db.delivery.count({
    where: {
      status: { notIn: [...TERMINAL_STATUSES, DeliveryStatus.cancelled] },
      assignedDriverId: null,
    },
  });
}

/**
 * Get recent delivery status history entries for the activity feed.
 */
export async function getRecentDeliveryActivity(take = 12) {
  return db.deliveryStatusHistory.findMany({
    take,
    orderBy: { changedAt: "desc" },
    include: {
      delivery: {
        select: {
          id: true,
          deliveryAddress: true,
          customer: { select: { companyName: true } },
        },
      },
    },
  });
}
