export default function SettingsPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <p className="text-sm text-slate-600">
        CRM v1 uses header-based admin writes. Set `ADMIN_TOKEN` locally and in Vercel.
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p>- Read endpoints are currently open for internal iteration.</p>
        <p>- Write endpoints require `x-admin-token` header.</p>
        <p>- Next phase can replace this with full auth/RBAC.</p>
      </div>
    </div>
  );
}
