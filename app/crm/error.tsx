"use client";

import { useEffect } from "react";

type CrmErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const DB_URL_HINT = "DATABASE_URL environment variable is not set";
const MIGRATION_HINT = /relation|table|column|does not exist|no such table/i;
const CONNECTION_HINT = /connect|ECONNREFUSED|timeout|network|ssl|authentication/i;

function classifyError(message: string) {
  if (message.includes(DB_URL_HINT)) {
    return {
      title: "DATABASE_URL not configured",
      detail:
        "The DATABASE_URL environment variable is missing. " +
        "Set it to your Neon Postgres connection string in Vercel Project Settings → Environment Variables.",
      step: "Go to vercel.com → your project → Settings → Environment Variables and add DATABASE_URL.",
    };
  }
  if (MIGRATION_HINT.test(message)) {
    return {
      title: "Database migrations have not been applied",
      detail:
        "The database is connected but the required tables don't exist yet. " +
        "You need to run migrations against the production database.",
      step: 'Run: DATABASE_URL="<your-neon-url>" npx prisma migrate deploy',
    };
  }
  if (CONNECTION_HINT.test(message)) {
    return {
      title: "Cannot connect to database",
      detail:
        "The application cannot reach the database. " +
        "Check that your DATABASE_URL is correct and the Neon database is active.",
      step: "Verify DATABASE_URL in Vercel env vars matches your Neon project connection string (include ?sslmode=require).",
    };
  }
  return null;
}

export default function CrmError({ error, reset }: CrmErrorProps) {
  useEffect(() => {
    console.error("[CRM Error]", error);
  }, [error]);

  const classification = classifyError(error.message ?? "");

  return (
    <div className="min-h-[60vh] flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-xl space-y-5">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-800">
            {classification?.title ?? "Something went wrong"}
          </h2>
          <p className="mt-1 text-sm text-rose-700">
            {classification?.detail ?? "A server-side error occurred while loading this page."}
          </p>
          {error.digest ? (
            <p className="mt-2 text-xs text-rose-500 font-mono">Digest: {error.digest}</p>
          ) : null}
        </div>

        {classification?.step ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">How to fix</h3>
            <p className="text-sm text-slate-600">{classification.step}</p>
            <div className="mt-2 space-y-1 text-sm text-slate-500">
              <p>
                See{" "}
                <a
                  href="https://github.com/RSronin09/provlos-crm/blob/main/README.md"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  README.md
                </a>{" "}
                for full setup instructions.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Error details</h3>
            <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all bg-slate-50 rounded p-3">
              {error.message || "No message available"}
            </pre>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Try again
          </button>
          <a
            href="/crm/dashboard"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
