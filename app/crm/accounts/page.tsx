import { db } from "@/lib/db";
import { AccountStage, EnrichmentStatus } from "@prisma/client";
import Link from "next/link";

type AccountsPageProps = {
  searchParams?: {
    search?: string;
    industry?: string;
    stage?: AccountStage;
    enrichmentStatus?: EnrichmentStatus;
    state?: string;
    region?: string;
  };
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const filters = searchParams ?? {};
  let dbWarning: string | null = null;
  let accounts: Awaited<ReturnType<typeof db.account.findMany>> = [];

  try {
    accounts = await db.account.findMany({
      where: {
        ...(filters.search
          ? {
              OR: [
                { companyName: { contains: filters.search, mode: "insensitive" } },
                { website: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(filters.industry
          ? { industry: { equals: filters.industry, mode: "insensitive" } }
          : {}),
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.enrichmentStatus ? { enrichmentStatus: filters.enrichmentStatus } : {}),
        ...(filters.state ? { state: { equals: filters.state, mode: "insensitive" } } : {}),
        ...(filters.region ? { region: { equals: filters.region, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  } catch {
    dbWarning = "Database is unreachable. Check DATABASE_URL and run migrations.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Accounts</h2>
        <p className="text-sm text-slate-600">Target list and funnel management.</p>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-6">
        <input
          type="text"
          name="search"
          placeholder="Search company / website"
          defaultValue={filters.search}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
        <input
          type="text"
          name="industry"
          placeholder="Industry"
          defaultValue={filters.industry}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="stage"
          defaultValue={filters.stage ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All stages</option>
          {Object.values(AccountStage).map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
        <select
          name="enrichmentStatus"
          defaultValue={filters.enrichmentStatus ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All enrichment statuses</option>
          {Object.values(EnrichmentStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="text"
            name="state"
            placeholder="State"
            defaultValue={filters.state}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            name="region"
            placeholder="Region"
            defaultValue={filters.region}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Apply
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Enrichment</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Region</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/crm/accounts/${account.id}`} className="underline-offset-2 hover:underline">
                    {account.companyName}
                  </Link>
                </td>
                <td className="px-4 py-3">{account.industry ?? "-"}</td>
                <td className="px-4 py-3">{account.stage}</td>
                <td className="px-4 py-3">{account.enrichmentStatus}</td>
                <td className="px-4 py-3">{account.state ?? "-"}</td>
                <td className="px-4 py-3">{account.region ?? "-"}</td>
              </tr>
            ))}
            {accounts.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                  No accounts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {dbWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {dbWarning}
        </p>
      ) : null}
    </div>
  );
}
