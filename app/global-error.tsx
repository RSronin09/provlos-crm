"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <h1 className="text-base font-semibold text-rose-800">Application Error</h1>
            <p className="mt-1 text-sm text-rose-700">
              A server-side exception occurred. Check that{" "}
              <code className="bg-rose-100 px-1 rounded">DATABASE_URL</code> and{" "}
              <code className="bg-rose-100 px-1 rounded">ADMIN_TOKEN</code> are set in your Vercel
              project environment variables.
            </p>
            {error.digest ? (
              <p className="mt-2 text-xs text-rose-500 font-mono">Digest: {error.digest}</p>
            ) : null}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Go to home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
