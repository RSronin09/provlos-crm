"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DriverForm } from "./driver-form";

type DriverRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  vehicleName: string | null;
  isActive: boolean;
  _count: { deliveries: number };
};

type DriversPanelProps = {
  drivers: DriverRow[];
};

export function DriversPanel({ drivers }: DriversPanelProps) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editDriver, setEditDriver] = useState<DriverRow | null>(null);

  function handleSuccess() {
    setShowAdd(false);
    setEditDriver(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Driver Roster</h2>
        <button
          onClick={() => { setShowAdd(true); setEditDriver(null); }}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          + Add Driver
        </button>
      </div>

      {/* Add / Edit Form Modal */}
      {(showAdd || editDriver) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              {editDriver ? `Edit Driver — ${editDriver.name}` : "Add New Driver"}
            </h3>
            <DriverForm
              mode={editDriver ? "edit" : "create"}
              driverId={editDriver?.id}
              initialName={editDriver?.name}
              initialPhone={editDriver?.phone ?? ""}
              initialEmail={editDriver?.email ?? ""}
              initialVehicle={editDriver?.vehicleName ?? ""}
              initialActive={editDriver?.isActive ?? true}
              onSuccess={handleSuccess}
              onCancel={() => { setShowAdd(false); setEditDriver(null); }}
            />
          </div>
        </div>
      ) : null}

      {drivers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-600">No drivers yet</p>
          <p className="mt-1 text-xs text-slate-400">Add your first driver to start dispatching.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Open Deliveries</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-3 text-slate-600">{d.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{d.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{d.vehicleName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        d._count.deliveries === 0
                          ? "bg-slate-100 text-slate-500"
                          : d._count.deliveries >= 3
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {d._count.deliveries}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        d.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}
                    >
                      {d.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setEditDriver(d); setShowAdd(false); }}
                      className="text-xs text-blue-700 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
