"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface DriverPin {
  driverId: string;
  name: string;
  lat: number;
  lng: number;
  openCount: number;
  capturedAt: string;
}

export interface DeliveryPin {
  id: string;
  type: "pickup" | "dropoff";
  lat: number;
  lng: number;
  address: string;
  status: string;
  isOverdue: boolean;
  isAtRisk: boolean;
  customerName?: string | null;
  requestedAt: string;
}

export interface LiveMapProps {
  drivers: DriverPin[];
  deliveries: DeliveryPin[];
  onSelectDelivery?: (id: string) => void;
  onSelectDriver?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
}

function makeDriverIcon(openCount: number) {
  const color = openCount === 0 ? "#6b7280" : openCount <= 2 ? "#2563eb" : "#dc2626";
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};color:#fff;border-radius:50%;width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;
      font-size:18px;box-shadow:0 2px 6px rgba(0,0,0,0.35);
      border:2px solid #fff;cursor:pointer;">🚚</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function makeDeliveryIcon(type: "pickup" | "dropoff", isOverdue: boolean, isAtRisk: boolean) {
  let color = type === "pickup" ? "#16a34a" : "#2563eb";
  if (isOverdue) color = "#dc2626";
  else if (isAtRisk) color = "#d97706";

  const emoji = type === "pickup" ? "📦" : "📍";
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};color:#fff;border-radius:6px;width:30px;height:30px;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;box-shadow:0 2px 5px rgba(0,0,0,0.3);
      border:2px solid #fff;cursor:pointer;">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function AutoCenter({ drivers, deliveries }: { drivers: DriverPin[]; deliveries: DeliveryPin[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [
      ...drivers.map((d) => [d.lat, d.lng] as [number, number]),
      ...deliveries.map((d) => [d.lat, d.lng] as [number, number]),
    ];
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function LiveMapInner({
  drivers,
  deliveries,
  onSelectDelivery,
  onSelectDriver,
  center = [39.5, -98.35],
  zoom = 5,
}: LiveMapProps) {
  const hasPoints = drivers.length > 0 || deliveries.length > 0;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {hasPoints && <AutoCenter drivers={drivers} deliveries={deliveries} />}

      {drivers.map((d) => (
        <Marker
          key={`driver-${d.driverId}`}
          position={[d.lat, d.lng]}
          icon={makeDriverIcon(d.openCount)}
          eventHandlers={{ click: () => onSelectDriver?.(d.driverId) }}
        >
          <Popup>
            <div className="text-sm font-medium">{d.name}</div>
            <div className="text-xs text-slate-500">{d.openCount} open deliveries</div>
            <div className="text-xs text-slate-400">
              Last seen: {new Date(d.capturedAt).toLocaleTimeString()}
            </div>
            {onSelectDriver && (
              <button
                onClick={() => onSelectDriver(d.driverId)}
                className="mt-1 text-xs text-blue-600 underline"
              >
                View workload
              </button>
            )}
          </Popup>
        </Marker>
      ))}

      {deliveries.map((d) => (
        <Marker
          key={`${d.type}-${d.id}`}
          position={[d.lat, d.lng]}
          icon={makeDeliveryIcon(d.type, d.isOverdue, d.isAtRisk)}
          eventHandlers={{ click: () => onSelectDelivery?.(d.id) }}
        >
          <Popup>
            <div className="space-y-0.5 text-xs">
              <div className="font-medium text-sm capitalize">
                {d.type === "pickup" ? "📦 Pickup" : "📍 Dropoff"}
                {d.isOverdue && <span className="ml-1 text-red-600">• Overdue</span>}
                {d.isAtRisk && !d.isOverdue && (
                  <span className="ml-1 text-amber-600">• At Risk</span>
                )}
              </div>
              {d.customerName && (
                <div className="text-slate-600">{d.customerName}</div>
              )}
              <div className="text-slate-500">{d.address}</div>
              <div className="text-slate-400">
                By: {new Date(d.requestedAt).toLocaleString()}
              </div>
              {onSelectDelivery && (
                <button
                  onClick={() => onSelectDelivery(d.id)}
                  className="mt-1 text-blue-600 underline"
                >
                  Open detail
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
