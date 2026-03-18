"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LiveMap } from "./live-map";
import type { DriverPin, DeliveryPin } from "./live-map-inner";
import { useAutoRefresh } from "@/lib/use-auto-refresh";

export interface LiveDriver {
  id: string;
  name: string;
  phone?: string | null;
  vehicleName?: string | null;
  openCount: number;
  location: { lat: number; lng: number; capturedAt: string } | null;
  deliveries: {
    id: string;
    status: string;
    deliveryAddress: string;
    requestedDeliveryDateTime: string;
    stopOrder: number | null;
    customer?: { companyName: string } | null;
  }[];
}

export interface LiveDelivery {
  id: string;
  status: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  requestedDeliveryDateTime: string;
  isOverdue: boolean;
  isAtRisk: boolean;
  priorityLevel: string;
  customer?: { companyName: string } | null;
  assignedDriver?: { id: string; name: string } | null;
}

interface Props {
  initialDrivers: LiveDriver[];
  initialDeliveries: LiveDelivery[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  en_route_to_pickup: "En Route to Pickup",
  picked_up: "Picked Up",
  en_route_to_delivery: "En Route to Delivery",
  delivered: "Delivered",
  issue_reported: "Issue",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  assigned: "bg-blue-100 text-blue-700",
  en_route_to_pickup: "bg-indigo-100 text-indigo-700",
  picked_up: "bg-purple-100 text-purple-700",
  en_route_to_delivery: "bg-violet-100 text-violet-700",
  delivered: "bg-green-100 text-green-700",
  issue_reported: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-500",
};

function timeSince(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function LiveOperationsPanel({ initialDrivers, initialDeliveries }: Props) {
  const [drivers, setDrivers] = useState<LiveDriver[]>(initialDrivers);
  const [deliveries, setDeliveries] = useState<LiveDelivery[]>(initialDeliveries);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Auto-refresh every 30s by re-fetching the API directly (preserves client state)
  const fetchFresh = useCallback(async () => {
    try {
      const [dRes, delRes] = await Promise.all([
        fetch("/api/drivers/locations"),
        fetch("/api/deliveries?openOnly=true&pageSize=200"),
      ]);
      if (dRes.ok) {
        const dData = await dRes.json();
        setDrivers(
          dData.drivers.map((d: {
            id: string; name: string; phone?: string | null; vehicleName?: string | null;
            _count: { deliveries: number };
            location: { lat: number; lng: number; capturedAt: string } | null;
            deliveries: LiveDriver["deliveries"];
          }) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            vehicleName: d.vehicleName,
            openCount: d._count.deliveries,
            location: d.location,
            deliveries: d.deliveries,
          })),
        );
      }
      if (delRes.ok) {
        const delData = await delRes.json();
        const now = new Date();
        setDeliveries(
          delData.data.map((d: {
            id: string; status: string; pickupAddress: string; deliveryAddress: string;
            pickupLat: number | null; pickupLng: number | null;
            deliveryLat: number | null; deliveryLng: number | null;
            requestedDeliveryDateTime: string; priorityLevel: string;
            customer?: { companyName: string } | null;
            assignedDriver?: { id: string; name: string } | null;
          }) => ({
            ...d,
            isOverdue: new Date(d.requestedDeliveryDateTime) < now,
            isAtRisk:
              new Date(d.requestedDeliveryDateTime) > now &&
              new Date(d.requestedDeliveryDateTime).getTime() - now.getTime() < 90 * 60_000,
          })),
        );
      }
      setLastRefresh(new Date());
    } catch {
      // silent — stale data is acceptable
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) fetchFresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchFresh]);

  // Build map pins from current state
  const driverPins: DriverPin[] = drivers
    .filter((d) => d.location != null)
    .map((d) => ({
      driverId: d.id,
      name: d.name,
      lat: d.location!.lat,
      lng: d.location!.lng,
      openCount: d.openCount,
      capturedAt: d.location!.capturedAt,
    }));

  const deliveryPins: DeliveryPin[] = deliveries.flatMap((d) => {
    const pins: DeliveryPin[] = [];
    if (d.pickupLat && d.pickupLng) {
      pins.push({
        id: d.id,
        type: "pickup",
        lat: d.pickupLat,
        lng: d.pickupLng,
        address: d.pickupAddress,
        status: d.status,
        isOverdue: d.isOverdue,
        isAtRisk: d.isAtRisk,
        customerName: d.customer?.companyName,
        requestedAt: d.requestedDeliveryDateTime,
      });
    }
    if (d.deliveryLat && d.deliveryLng) {
      pins.push({
        id: d.id,
        type: "dropoff",
        lat: d.deliveryLat,
        lng: d.deliveryLng,
        address: d.deliveryAddress,
        status: d.status,
        isOverdue: d.isOverdue,
        isAtRisk: d.isAtRisk,
        customerName: d.customer?.companyName,
        requestedAt: d.requestedDeliveryDateTime,
      });
    }
    return pins;
  });

  const selectedDelivery = deliveries.find((d) => d.id === selectedDeliveryId) ?? null;
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) ?? null;

  const overdueCount = deliveries.filter((d) => d.isOverdue).length;
  const atRiskCount = deliveries.filter((d) => d.isAtRisk && !d.isOverdue).length;
  const issueCount = deliveries.filter((d) => d.status === "issue_reported").length;
  const inProgressCount = deliveries.filter((d) =>
    ["en_route_to_pickup", "picked_up", "en_route_to_delivery"].includes(d.status),
  ).length;
  const activeDriverCount = driverPins.length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: "Active Drivers", value: activeDriverCount, color: "text-blue-700" },
          { label: "In Progress", value: inProgressCount, color: "text-indigo-700" },
          { label: "At Risk", value: atRiskCount, color: "text-amber-700" },
          { label: "Overdue", value: overdueCount, color: "text-red-700" },
          { label: "Issues", value: issueCount, color: "text-rose-700" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Map + side panel */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Map */}
        <div className="relative min-h-[500px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {driverPins.length === 0 && deliveryPins.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
              <div className="text-4xl mb-3">🗺️</div>
              <div className="font-medium">No location data yet</div>
              <div className="text-sm mt-1 text-slate-400">
                Drivers share location via the Driver View when active.
                <br />
                Deliveries are geocoded on creation.
              </div>
            </div>
          ) : (
            <LiveMap
              drivers={driverPins}
              deliveries={deliveryPins}
              onSelectDelivery={(id) => {
                setSelectedDeliveryId(id);
                setSelectedDriverId(null);
              }}
              onSelectDriver={(id) => {
                setSelectedDriverId(id);
                setSelectedDeliveryId(null);
              }}
            />
          )}
          <div className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-xs text-slate-400 shadow">
            Refreshed {timeSince(lastRefresh.toISOString())}
          </div>
        </div>

        {/* Info panel */}
        <div className="w-80 shrink-0 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          {selectedDelivery ? (
            <DeliveryInfoCard
              delivery={selectedDelivery}
              onClose={() => setSelectedDeliveryId(null)}
            />
          ) : selectedDriver ? (
            <DriverInfoCard
              driver={selectedDriver}
              onClose={() => setSelectedDriverId(null)}
            />
          ) : (
            <ActiveList
              drivers={drivers}
              deliveries={deliveries}
              onSelectDelivery={(id) => { setSelectedDeliveryId(id); setSelectedDriverId(null); }}
              onSelectDriver={(id) => { setSelectedDriverId(id); setSelectedDeliveryId(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryInfoCard({
  delivery,
  onClose,
}: {
  delivery: LiveDelivery;
  onClose: () => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_COLOR[delivery.status] ?? "bg-slate-100 text-slate-700"
            }`}
          >
            {STATUS_LABEL[delivery.status] ?? delivery.status}
          </span>
          {delivery.isOverdue && (
            <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Overdue
            </span>
          )}
          {delivery.isAtRisk && !delivery.isOverdue && (
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              At Risk
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">
          ×
        </button>
      </div>

      {delivery.customer && (
        <div className="text-sm font-medium text-slate-800">{delivery.customer.companyName}</div>
      )}

      <div className="space-y-1 text-xs text-slate-600">
        <div>
          <span className="font-medium">Pickup:</span> {delivery.pickupAddress}
        </div>
        <div>
          <span className="font-medium">Delivery:</span> {delivery.deliveryAddress}
        </div>
        <div>
          <span className="font-medium">Due:</span>{" "}
          {new Date(delivery.requestedDeliveryDateTime).toLocaleString()}
        </div>
        {delivery.assignedDriver && (
          <div>
            <span className="font-medium">Driver:</span> {delivery.assignedDriver.name}
          </div>
        )}
      </div>

      <Link
        href={`/crm/deliveries/${delivery.id}`}
        className="block rounded-md bg-blue-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-blue-700"
      >
        Open Delivery Detail →
      </Link>
    </div>
  );
}

function DriverInfoCard({
  driver,
  onClose,
}: {
  driver: LiveDriver;
  onClose: () => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-slate-800">{driver.name}</div>
          {driver.vehicleName && (
            <div className="text-xs text-slate-500">{driver.vehicleName}</div>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">
          ×
        </button>
      </div>

      {driver.location ? (
        <div className="text-xs text-slate-500">
          Last seen: {timeSince(driver.location.capturedAt)}
        </div>
      ) : (
        <div className="text-xs text-amber-600">No location data</div>
      )}

      <div className="text-sm font-medium text-slate-700">
        {driver.openCount} open delivery{driver.openCount !== 1 ? "ies" : ""}
      </div>

      {driver.deliveries.length > 0 && (
        <div className="space-y-1">
          {driver.deliveries.map((d, i) => (
            <div key={d.id} className="rounded bg-slate-50 px-2 py-1.5 text-xs">
              <span className="font-medium text-slate-600">Stop {d.stopOrder ?? i + 1}:</span>{" "}
              <span className="text-slate-700">{d.deliveryAddress}</span>
              {d.customer && (
                <div className="text-slate-400 mt-0.5">{d.customer.companyName}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {driver.phone && (
        <a
          href={`tel:${driver.phone}`}
          className="block rounded-md border border-slate-200 px-3 py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          📞 Call {driver.name}
        </a>
      )}
    </div>
  );
}

function ActiveList({
  drivers,
  deliveries,
  onSelectDelivery,
  onSelectDriver,
}: {
  drivers: LiveDriver[];
  deliveries: LiveDelivery[];
  onSelectDelivery: (id: string) => void;
  onSelectDriver: (id: string) => void;
}) {
  const urgent = deliveries.filter((d) => d.isOverdue || d.isAtRisk || d.status === "issue_reported");
  const active = drivers.filter((d) => d.openCount > 0);

  return (
    <div className="p-3 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Click a marker or item to inspect
      </div>

      {urgent.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-red-700 mb-1">⚠ Needs Attention</div>
          <div className="space-y-1">
            {urgent.slice(0, 8).map((d) => (
              <button
                key={d.id}
                onClick={() => onSelectDelivery(d.id)}
                className="w-full rounded border border-red-100 bg-red-50 px-2 py-1.5 text-left text-xs hover:bg-red-100"
              >
                <div className="font-medium text-red-800 truncate">{d.deliveryAddress}</div>
                <div className="text-red-600">
                  {d.isOverdue ? "Overdue" : d.status === "issue_reported" ? "Issue" : "At Risk"}
                  {d.assignedDriver ? ` · ${d.assignedDriver.name}` : " · Unassigned"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-blue-700 mb-1">🚚 Active Drivers</div>
          <div className="space-y-1">
            {active.map((d) => (
              <button
                key={d.id}
                onClick={() => onSelectDriver(d.id)}
                className="w-full rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-left text-xs hover:bg-blue-100"
              >
                <div className="font-medium text-blue-800">{d.name}</div>
                <div className="text-blue-600">
                  {d.openCount} stop{d.openCount !== 1 ? "s" : ""}
                  {d.location ? ` · ${timeSince(d.location.capturedAt)}` : " · No location"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {urgent.length === 0 && active.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-8">
          All clear — no active issues or in-progress deliveries.
        </div>
      )}
    </div>
  );
}
