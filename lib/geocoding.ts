export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Geocode a street address using the Nominatim OpenStreetMap API.
 * Free, no API key required. Rate-limited to ~1 req/s per ToS.
 * Swap this implementation for Google Maps or Mapbox as needed.
 */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  if (!address?.trim()) return null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      new URLSearchParams({ q: address, format: "json", limit: "1" });
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ProvLOS-CRM/1.0 (delivery-dispatch)",
        "Accept-Language": "en",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data: Array<{ lat: string; lon: string }> = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/**
 * Geocode pickup and delivery addresses for a delivery.
 * Returns partial result — whichever addresses succeeded.
 */
export async function geocodeDeliveryAddresses(
  pickupAddress: string,
  deliveryAddress: string,
): Promise<{
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
}> {
  const [pickup, delivery] = await Promise.allSettled([
    geocodeAddress(pickupAddress),
    geocodeAddress(deliveryAddress),
  ]);

  const p = pickup.status === "fulfilled" ? pickup.value : null;
  const d = delivery.status === "fulfilled" ? delivery.value : null;

  return {
    pickupLat: p?.lat ?? null,
    pickupLng: p?.lng ?? null,
    deliveryLat: d?.lat ?? null,
    deliveryLng: d?.lng ?? null,
  };
}

/**
 * Haversine great-circle distance in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Build a navigation deep-link for a given address.
 * provider: "apple" | "google" | "waze"
 */
export function buildNavLink(
  provider: "apple" | "google" | "waze",
  address: string,
  lat?: number | null,
  lng?: number | null,
): string {
  const encoded = encodeURIComponent(address);
  if (provider === "apple") {
    return lat && lng
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `maps://maps.apple.com/?daddr=${encoded}`;
  }
  if (provider === "google") {
    return lat && lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }
  // Waze
  return lat && lng
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://waze.com/ul?q=${encoded}&navigate=yes`;
}
