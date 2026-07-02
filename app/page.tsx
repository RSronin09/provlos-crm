import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <main className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Doctors Transport</h1>
        <p className="mt-2 text-sm text-slate-600">
          Operations platform for vendor &amp; customer relationships, dispatching, and driver monitoring.
        </p>
        <Link
          href="/crm"
          className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Open CRM Dashboard
        </Link>
      </main>
    </div>
  );
}
