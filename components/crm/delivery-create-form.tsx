"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; companyName: string };
type Driver = { id: string; name: string };

type DeliveryCreateFormProps = {
  accounts: Account[];
  drivers: Driver[];
  suggestedDriverId: string | null;
  prefilledCustomerId?: string | null;
};

export function DeliveryCreateForm({
  accounts,
  drivers,
  suggestedDriverId,
  prefilledCustomerId,
}: DeliveryCreateFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(prefilledCustomerId ?? "");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [requestedDeliveryDateTime, setRequestedDeliveryDateTime] = useState("");
  const [pickupDateTime, setPickupDateTime] = useState("");
  const [pickupContactName, setPickupContactName] = useState("");
  const [pickupContactPhone, setPickupContactPhone] = useState("");
  const [deliveryContactName, setDeliveryContactName] = useState("");
  const [deliveryContactPhone, setDeliveryContactPhone] = useState("");
  const [packageNotes, setPackageNotes] = useState("");
  const [priorityLevel, setPriorityLevel] = useState<"standard" | "urgent">("standard");
  const [assignedDriverId, setAssignedDriverId] = useState(suggestedDriverId ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!pickupAddress.trim()) { setError("Pickup address is required."); return; }
    if (!deliveryAddress.trim()) { setError("Delivery address is required."); return; }
    if (!requestedDeliveryDateTime) { setError("Requested delivery date/time is required."); return; }

    setBusy(true);
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || null,
          pickupAddress,
          deliveryAddress,
          requestedDeliveryDateTime,
          pickupDateTime: pickupDateTime || null,
          pickupContactName: pickupContactName || null,
          pickupContactPhone: pickupContactPhone || null,
          deliveryContactName: deliveryContactName || null,
          deliveryContactPhone: deliveryContactPhone || null,
          packageNotes: packageNotes || null,
          priorityLevel,
          assignedDriverId: assignedDriverId || null,
          createdBy: "dispatcher",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to create delivery.");
      }

      const data = await res.json();
      router.push(`/crm/deliveries/${data.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Account / Customer */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Customer & Priority</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Customer Account <span className="text-slate-400">(optional)</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— No account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
            <select
              value={priorityLevel}
              onChange={(e) => setPriorityLevel(e.target.value as "standard" | "urgent")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="standard">Standard</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Addresses */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Addresses</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Pickup Address <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="123 Warehouse Blvd, City, ST 00000"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Delivery Address <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="456 Client Ave, City, ST 00000"
            />
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Scheduling</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Pickup Date / Time <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={pickupDateTime}
              onChange={(e) => setPickupDateTime(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Requested Delivery Date / Time <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={requestedDeliveryDateTime}
              onChange={(e) => setRequestedDeliveryDateTime(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Contacts */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Contact Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pickup Contact</p>
            <input
              type="text"
              value={pickupContactName}
              onChange={(e) => setPickupContactName(e.target.value)}
              placeholder="Contact name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="tel"
              value={pickupContactPhone}
              onChange={(e) => setPickupContactPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery Contact</p>
            <input
              type="text"
              value={deliveryContactName}
              onChange={(e) => setDeliveryContactName(e.target.value)}
              placeholder="Contact name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="tel"
              value={deliveryContactPhone}
              onChange={(e) => setDeliveryContactPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Notes & Driver */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Package Notes & Driver Assignment</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Package Notes / Instructions
            </label>
            <textarea
              value={packageNotes}
              onChange={(e) => setPackageNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Fragile, keep upright, requires signature..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Assign Driver{" "}
              {suggestedDriverId && !assignedDriverId ? (
                <span className="ml-1 text-xs text-blue-600">(auto-suggested)</span>
              ) : null}
            </label>
            <select
              value={assignedDriverId}
              onChange={(e) => setAssignedDriverId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Unassigned —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Driver with fewest open deliveries is pre-selected when available.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <a
          href="/crm/deliveries/all"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create Delivery"}
        </button>
      </div>
    </form>
  );
}
