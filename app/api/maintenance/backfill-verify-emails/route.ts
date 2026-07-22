import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { isInstantlyConfigured, verifyEmail } from "@/lib/instantly";
import { NextRequest } from "next/server";
import { z } from "zod";

// One-time backfill: every email saved before the verification gate existed
// (emailStatus is null) gets checked against Instantly's verifier. Mirrors
// find-missing-emails' proven-safe envelope — same batch cap, concurrency,
// and time budget, measured against production to stay under Vercel's 60s
// function limit.
export const maxDuration = 60;

const TIME_BUDGET_MS = 15_000;
const PER_CONTACT_TIMEOUT_MS = 12_000;
const CONCURRENCY = 3;

const bodySchema = z.object({
  batchSize: z.number().int().min(1).max(10).default(5),
  cursor: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .optional(),
});

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }
  if (!isInstantlyConfigured()) {
    return Response.json({ error: "INSTANTLY_API_KEY is not configured." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  // Legacy-only: never re-verify what the enrichment cascade already
  // stamped, and never touch quarantined (unverified-identity) contacts —
  // they're excluded from outreach regardless of email deliverability.
  const whereUnchecked = {
    email: { not: null },
    emailStatus: null,
    isUnverifiedIdentity: false,
  } as const;

  const totalUnchecked = await db.contact.count({ where: whereUnchecked });

  const contacts = await db.contact.findMany({
    where: parsed.data.cursor
      ? { AND: [whereUnchecked, { id: { gt: parsed.data.cursor } } as const] }
      : whereUnchecked,
    orderBy: { id: "asc" },
    take: parsed.data.batchSize,
    select: { id: true, email: true },
  });

  if (!contacts.length) {
    return Response.json({
      data: { processed: 0, verified: 0, risky: 0, invalid: 0, results: [], nextCursor: null, totalUnchecked },
      message: "No legacy emails left to verify.",
    });
  }

  const startedAt = Date.now();
  let verified = 0;
  let risky = 0;
  let invalid = 0;
  const results: { contactId: string; email: string; status: string }[] = [];
  let processedThrough: string | null = null;

  const verifyOne = async (contact: (typeof contacts)[number]) => {
    let status = "error";
    try {
      const check = await Promise.race([
        verifyEmail(contact.email as string),
        new Promise<{ status: "pending"; catchAll: false }>((resolve) =>
          setTimeout(() => resolve({ status: "pending", catchAll: false }), PER_CONTACT_TIMEOUT_MS),
        ),
      ]);

      if (check.status === "verified" && !check.catchAll) {
        status = "verified";
        verified++;
      } else if (check.status === "invalid") {
        // Flagged, never deleted — the address stays on record so the team
        // can see it bounced, but outreach tooling should treat it as dead.
        status = "invalid";
        invalid++;
      } else {
        status = "risky"; // catch-all domain, pending/timeout, or API error
        risky++;
      }

      await db.contact.update({ where: { id: contact.id }, data: { emailStatus: status } });
    } catch (error) {
      console.error(`Backfill verify failed for ${contact.id}:`, error instanceof Error ? error.message : error);
    }
    results.push({ contactId: contact.id, email: contact.email as string, status });
  };

  for (let i = 0; i < contacts.length; i += CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS && processedThrough) break;
    const chunk = contacts.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(verifyOne));
    processedThrough = chunk[chunk.length - 1].id;
  }

  const processed = results.length;
  const moreInBatchWindow = processed === contacts.length && contacts.length === parsed.data.batchSize;
  const stoppedEarly = processed < contacts.length;
  const nextCursor = moreInBatchWindow || stoppedEarly ? processedThrough : null;

  return Response.json({
    data: { processed, verified, risky, invalid, results, nextCursor, totalUnchecked },
    message: `Verified ${processed} email(s): ${verified} verified, ${risky} risky, ${invalid} invalid.`,
  });
}
