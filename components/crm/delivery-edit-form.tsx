"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; companyName: string };
type Driver = { id: string; name: string };

export type DeliveryEditInitialValues = {
  id: string;
  customerId: string | null;
  pickupAddress: string;
  deliveryAddress: string;
  requestedDeliveryDateTime: string; // ISO string
  pickupDateTime: string | null;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  packageNotes: string | null;
  priorityLevel: "standard" | "urgent";
  assignedDriverId: string | null;
};

type DeliveryEditFormProps = {
  initialValues: DeliveryEditInitialValues;
  accounts: Account[];
  drivers: Driver[];
};

/** Convert a UTC ISO datetime string to a datetime-local input value
 * (YYYY-MM-DDTHH:mm) expressed in the browser's local timezone. Using
 * slice() on the raw ISO string would show UTC clock time instead of the
 * dispatcher's local time, which can be off by several hours. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Convert a datetime-local input value (local wall-clock time) back to a
 * true UTC ISO instant for the server, which runs in UTC. */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function DeliveryEditForm({ initialValues, accounts, drivers }: DeliveryEditFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [customerId, setCustomerId] = useState(initialValues.customerId ?? "");
  const [pickupAddress, setPickupAddress] = useState(initialValues.pickupAddress);
  const [deliveryAddress, setDeliveryAddress] = useState(initialValues.deliveryAddress);
  const [requestedDeliveryDateTime, setRequestedDeliveryDateTime] = useState(
    toLocalInputValue(initialValues.requestedDeliveryDateTime),
  );
  const [pickupDateTime, setPickupDateTime] = useState(
    toLocalInputValue(initialValues.pickupDateTime),
  );
  const [pickupContactName, setPickupContactName] = useState(
    initialValues.pickupContactName ?? "",
  );
  const [pickupContactPhone, setPickupContactPhone] = useState(
    initialValues.pickupContactPhone ?? "",
  );
  const [deliveryContactName, setDeliveryContactName] = useState(
    initialValues.deliveryContactName ?? "",
  );
  const [deliveryContactPhone, setDeliveryContactPhone] = useState(
    initialValues.deliveryContactPhone ?? "",
  );
  const [packageNotes, setPackageNotes] = useState(initialValues.packageNotes ?? "");
  const [priorityLevel, setPriorityLevel] = useState<"standard" | "urgent">(
    initialValues.priorityLevel,
  );
  const [assignedDriverId, setAssignedDriverId] = useState(
    initialValues.assignedDriverId ?? "",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!pickupAddress.trim()) { setError("Pickup address is required."); return; }
    if (!deliveryAddress.trim()) { setError("Delivery address is required."); return; }
    if (!requestedDeliveryDateTime) { setError("Requested delivery date/time is required."); return; }

    const requestedIso = localInputToIso(requestedDeliveryDateTime);
    if (!requestedIso) { setError("Invalid requested delivery date/time."); return; }

    setBusy(true);
    try {
      const res = await fetch(`/api/deliveries/${initialValues.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || null,
          pickupAddress,
          deliveryAddress,
          requestedDeliveryDateTime: requestedIso,
          pickupDateTime: localInputToIso(pickupDateTime),
          pickupContactName: pickupContactName || null,
          pickupContactPhone: pickupContactPhone || null,
          deliveryContactName: deliveryContactName || null,
          deliveryContactPhone: deliveryContactPhone || null,
          packageNotes: packageNotes || null,
          priorityLevel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to save changes.");
      }

      // Driver assignment changes go through the dedicated /assign endpoint
      // so delivery status, assignedAt, and status history stay consistent —
      // the generic PATCH above intentionally does not touch driver assignment.
      const initialDriverId = initialValues.assignedDriverId ?? "";
      if (assignedDriverId !== initialDriverId) {
        const assignRes = await fetch(`/api/deliveries/${initialValues.id}/assign`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverId: assignedDriverId || null,
            changedBy: "dispatcher",
          }),
        });
        if (!assignRes.ok) {
          const data = await assignRes.json().catch(() => ({}));
          throw new Error(data?.error ?? "Saved delivery details, but failed to update driver assignment.");
        }
      }

      setSuccess(true);
      router.push(`/crm/deliveries/${initialValues.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Changes saved — redirecting…
        </div>
      )}

      {/* Customer & Priority */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Customer &amp; Priority</h2>
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
        <p className="text-xs text-slate-400">
          Addresses will be re-geocoded automatically when saved, updating map pins.
        </p>
      </div>

      {/* Scheduling */}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pickup Contact
            </p>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Delivery Contact
            </p>
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

      {/* Package Notes & Driver */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Package Notes &amp; Driver Assignment</h2>
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
              placeholder="Fragile, keep upright, requires signature…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Assigned Driver
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
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <a
          href={`/crm/deliveries/${initialValues.id}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
