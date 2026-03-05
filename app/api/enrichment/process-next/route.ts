import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const queued = await db.enrichmentJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });

  if (!queued) {
    return Response.json({ message: "No queued jobs found" });
  }

  const startedAt = new Date();

  await db.enrichmentJob.update({
    where: { id: queued.id },
    data: {
      status: "RUNNING",
      startedAt,
      attemptCount: { increment: 1 },
      lastError: null,
    },
  });

  try {
    // Placeholder: in v1 we mark the single job done quickly.
    const finishedAt = new Date();

    const [job] = await db.$transaction([
      db.enrichmentJob.update({
        where: { id: queued.id },
        data: {
          status: "DONE",
          finishedAt,
        },
      }),
      db.account.update({
        where: { id: queued.accountId },
        data: { enrichmentStatus: "ENRICHED" },
      }),
    ]);

    return Response.json({
      data: job,
      message: "Processed one enrichment job",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await db.enrichmentJob.update({
      where: { id: queued.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        lastError: message,
      },
    });

    await db.account.update({
      where: { id: queued.accountId },
      data: { enrichmentStatus: "FAILED" },
    });

    return Response.json({ error: "Failed to process job", details: message }, { status: 500 });
  }
}
