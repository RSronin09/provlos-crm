import { haversineDistanceKm } from "./geocoding";

/** Average assumed urban delivery speed (km/h). Swap for routing API result. */
const AVG_SPEED_KMH = 30;

/** Minutes to add as a buffer for stops, traffic, etc. */
const STOP_BUFFER_MINUTES = 5;

export interface DeliveryETA {
  estimatedPickupMinutes: number | null;
  estimatedDeliveryMinutes: number | null;
  estimatedArrivalAt: Date | null;
  minutesUntilDeadline: number | null;
  isAtRisk: boolean;
  isOverdue: boolean;
}

export interface DriverCandidate {
  driverId: string;
  name: string;
  openCount: number;
  distanceKm: number | null;
  score: number;
  recommended: boolean;
}

/**
 * Estimate travel time in minutes between two geo points.
 * Uses Haversine distance + average speed assumption.
 */
export function estimateTravelMinutes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const distKm = haversineDistanceKm(fromLat, fromLng, toLat, toLng);
  const hours = distKm / AVG_SPEED_KMH;
  return Math.ceil(hours * 60) + STOP_BUFFER_MINUTES;
}

/**
 * Compute ETA for a delivery given an optional driver current location.
 */
export function computeDeliveryETA(
  delivery: {
    requestedDeliveryDateTime: Date;
    pickupLat: number | null;
    pickupLng: number | null;
    deliveryLat: number | null;
    deliveryLng: number | null;
  },
  driverLat?: number | null,
  driverLng?: number | null,
): DeliveryETA {
  const now = new Date();
  const minutesUntilDeadline =
    (delivery.requestedDeliveryDateTime.getTime() - now.getTime()) / 60_000;

  let estimatedPickupMinutes: number | null = null;
  let estimatedDeliveryMinutes: number | null = null;
  let estimatedArrivalAt: Date | null = null;

  const hasDriverLoc = driverLat != null && driverLng != null;
  const hasPickupCoords =
    delivery.pickupLat != null && delivery.pickupLng != null;
  const hasDeliveryCoords =
    delivery.deliveryLat != null && delivery.deliveryLng != null;

  if (hasDriverLoc && hasPickupCoords) {
    estimatedPickupMinutes = estimateTravelMinutes(
      driverLat!,
      driverLng!,
      delivery.pickupLat!,
      delivery.pickupLng!,
    );
  }

  if (hasPickupCoords && hasDeliveryCoords) {
    estimatedDeliveryMinutes = estimateTravelMinutes(
      delivery.pickupLat!,
      delivery.pickupLng!,
      delivery.deliveryLat!,
      delivery.deliveryLng!,
    );
  }

  if (estimatedPickupMinutes != null && estimatedDeliveryMinutes != null) {
    const totalMins = estimatedPickupMinutes + estimatedDeliveryMinutes;
    estimatedArrivalAt = new Date(now.getTime() + totalMins * 60_000);
  }

  const isOverdue = minutesUntilDeadline < 0;
  // At risk: < 90 minutes until deadline and we haven't delivered yet
  const isAtRisk = !isOverdue && minutesUntilDeadline < 90;

  return {
    estimatedPickupMinutes,
    estimatedDeliveryMinutes,
    estimatedArrivalAt,
    minutesUntilDeadline: Math.round(minutesUntilDeadline),
    isAtRisk,
    isOverdue,
  };
}

/**
 * Recommend which available driver to assign a delivery to.
 *
 * Scoring (lower is better):
 *  - Distance from driver's last location to delivery pickup (+km)
 *  - Open deliveries workload (+5 pts per open delivery)
 *  - Drivers without a location get a +50 penalty
 */
export function recommendDriverForDelivery(
  delivery: {
    pickupLat: number | null;
    pickupLng: number | null;
    priorityLevel: string;
  },
  drivers: Array<{
    driverId: string;
    name: string;
    openCount: number;
    lat: number | null;
    lng: number | null;
  }>,
): DriverCandidate[] {
  const rawCandidates = drivers.map((d) => {
    let distanceKm: number | null = null;
    let score = d.openCount * 5;

    if (
      d.lat != null &&
      d.lng != null &&
      delivery.pickupLat != null &&
      delivery.pickupLng != null
    ) {
      distanceKm = haversineDistanceKm(
        d.lat,
        d.lng,
        delivery.pickupLat,
        delivery.pickupLng,
      );
      score += distanceKm;
    } else {
      // No location data — add penalty
      score += 50;
    }

    return { driverId: d.driverId, name: d.name, openCount: d.openCount, distanceKm, score };
  });

  rawCandidates.sort((a, b) => a.score - b.score);

  const candidates: DriverCandidate[] = rawCandidates.map((c, i) => ({
    ...c,
    recommended: i === 0,
  }));

  return candidates;
}

/**
 * Recommend a stop sequence for a driver's open deliveries.
 *
 * Priority:
 * 1. Already in-progress (en_route_to_pickup / picked_up / en_route_to_delivery) → stays first
 * 2. Urgent before standard
 * 3. Earliest requestedDeliveryDateTime
 * 4. Nearest next stop (if coords available for current position)
 */
export function recommendSequenceForDriver<
  T extends {
    id: string;
    status: string;
    priorityLevel: string;
    requestedDeliveryDateTime: Date;
    stopOrder: number | null;
    pickupLat: number | null;
    pickupLng: number | null;
    deliveryLat: number | null;
    deliveryLng: number | null;
  },
>(
  deliveries: T[],
  driverLat?: number | null,
  driverLng?: number | null,
): T[] {
  const IN_PROGRESS = new Set([
    "en_route_to_pickup",
    "picked_up",
    "en_route_to_delivery",
  ]);

  return [...deliveries].sort((a, b) => {
    const aInProgress = IN_PROGRESS.has(a.status) ? 0 : 1;
    const bInProgress = IN_PROGRESS.has(b.status) ? 0 : 1;
    if (aInProgress !== bInProgress) return aInProgress - bInProgress;

    // Urgent before standard
    const aUrgent = a.priorityLevel === "urgent" ? 0 : 1;
    const bUrgent = b.priorityLevel === "urgent" ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;

    // Earliest deadline
    const timeDiff =
      a.requestedDeliveryDateTime.getTime() -
      b.requestedDeliveryDateTime.getTime();
    if (timeDiff !== 0) return timeDiff;

    // Nearest pickup if coords available
    if (driverLat != null && driverLng != null) {
      const aPickupLat = a.pickupLat ?? a.deliveryLat;
      const aPickupLng = a.pickupLng ?? a.deliveryLng;
      const bPickupLat = b.pickupLat ?? b.deliveryLat;
      const bPickupLng = b.pickupLng ?? b.deliveryLng;
      if (aPickupLat && aPickupLng && bPickupLat && bPickupLng) {
        const distA = haversineDistanceKm(driverLat, driverLng, aPickupLat, aPickupLng);
        const distB = haversineDistanceKm(driverLat, driverLng, bPickupLat, bPickupLng);
        return distA - distB;
      }
    }

    return 0;
  });
}
