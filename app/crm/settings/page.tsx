import { CleanupContactsButton } from "@/components/crm/cleanup-contacts-button";
import { PageHeader } from "@/components/crm/ui/page-header";
import Link from "next/link";

function KeyStatus({ name, value }: { name: string; value: string | undefined }) {
  const isSet = !!value;
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-800 font-mono">{name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {isSet ? "Configured" : "Not set"}
        </p>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          isSet
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-600"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isSet ? "bg-green-500" : "bg-red-500"}`} />
        {isSet ? "Active" : "Missing"}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const serperKey = process.env.SERPER_API_KEY;
  const hunterKey = process.env.HUNTER_API_KEY;
  const apolloKey = process.env.APOLLO_API_KEY;
  const pdlKey = process.env.PDL_API_KEY;
  const instantlyKey = process.env.INSTANTLY_API_KEY;
  const dbUrl = process.env.DATABASE_URL;
  const adminToken = process.env.ADMIN_TOKEN;

  const enrichmentReady = !!(apolloKey || pdlKey || serperKey || hunterKey);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="System configuration, API key status, and quick links."
      />

      {/* API Key Health */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">API Key Status</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Set these in your Vercel project under Settings → Environment Variables, then redeploy.
          </p>
        </div>
        <div className="px-5">
          <KeyStatus name="DATABASE_URL" value={dbUrl} />
          <KeyStatus name="APOLLO_API_KEY" value={apolloKey} />
          <KeyStatus name="PDL_API_KEY" value={pdlKey} />
          <KeyStatus name="SERPER_API_KEY" value={serperKey} />
          <KeyStatus name="HUNTER_API_KEY" value={hunterKey} />
          <KeyStatus name="INSTANTLY_API_KEY" value={instantlyKey} />
          <KeyStatus name="ADMIN_TOKEN" value={adminToken} />
        </div>
      </div>

      {/* Enrichment readiness */}
      {!enrichmentReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-1">
            Enrichment not configured
          </h3>
          <p className="text-sm text-amber-700">
            To look up decision makers, you need at least one of{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">APOLLO_API_KEY</code>{" "}
            (B2B contacts){" "}or{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">PDL_API_KEY</code>{" "}
            (healthcare &amp; all industries fallback) set.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://app.apollo.io/#/settings/integrations/api"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
            >
              Get Apollo API key → (recommended)
            </a>
            <a
              href="https://dashboard.peopledatalabs.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Get PDL API key → (healthcare fallback)
            </a>
            <a
              href="https://serper.dev"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Get Serper API key →
            </a>
            <a
              href="https://hunter.io"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Get Hunter.io API key →
            </a>
          </div>
        </div>
      )}

      {/* Instantly Lead Finder readiness */}
      {!instantlyKey && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-1">
            Instantly Lead Finder not configured
          </h3>
          <p className="text-sm text-amber-700">
            The scaffolding for Instantly&apos;s SuperSearch lead database (see{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">/crm/discovery</code>{" "}
            → &quot;Instantly Lead Finder&quot; tab) is wired up and ready — set{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">INSTANTLY_API_KEY</code>{" "}
            to turn it on.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://app.instantly.ai/app/settings/integrations"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
            >
              Get Instantly API key →
            </a>
          </div>
        </div>
      )}

      {/* Auth */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Authentication</h2>
        <p className="text-sm text-slate-600">
          Write operations (import, enrich, create) check for an{" "}
          <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">ADMIN_TOKEN</code>{" "}
          environment variable. When not set, all writes are open (suitable for private/internal use).
        </p>
        <p className="text-xs text-slate-500">
          To restrict access: set <code className="font-mono text-xs">ADMIN_TOKEN=your-secret</code> in
          Vercel and enter the same value in the Admin Token field on the discovery and import pages.
        </p>
      </div>

      {/* Data hygiene */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Data Hygiene</h2>
        <p className="text-sm text-slate-600">
          Earlier web-search discovery sometimes saved snippet artifacts like &quot;Director Details&quot; as
          contacts. This scan finds contacts whose name isn&apos;t a real person <em>and</em> that carry no
          email, phone, or LinkedIn, and lets you delete them in one click. Contacts with any real data are
          never touched.
        </p>
        <CleanupContactsButton />
      </div>

      {/* Quick links */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { href: "/crm/discovery", label: "Lead Discovery", desc: "Search & enrich decision makers" },
            { href: "/crm/import", label: "Spreadsheet Import", desc: "Bulk import from Excel / CSV" },
            { href: "/crm/relationships/customers", label: "Customers", desc: "View & enrich customer accounts" },
            { href: "/crm/pipeline", label: "Pipeline", desc: "Customer deal pipeline board" },
            { href: "/crm/dashboard", label: "Dashboard", desc: "CRM & delivery KPIs" },
            { href: "/api/health", label: "Health Check API", desc: "JSON endpoint — server status" },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50 hover:border-slate-300 transition"
            >
              <span className="text-sm font-medium text-slate-800">{label}</span>
              <span className="text-xs text-slate-500 mt-0.5">{desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Deployment info */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Deployment</h2>
        <p className="text-sm text-slate-600">
          Vercel runs <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">prisma migrate deploy</code>{" "}
          before every build to keep the production database schema in sync automatically.
        </p>
        <p className="text-xs text-slate-500">
          Framework: Next.js 16 · ORM: Prisma · Database: PostgreSQL · Styling: Tailwind CSS
        </p>
      </div>
    </div>
  );
}
