import { unauthorizedResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { buildLeadCandidates } from "@/lib/discovery";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const queued = await db.leadDiscoveryJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });

  if (!queued) {
    return Response.json({ message: "No queued discovery jobs found" });
  }

  await db.leadDiscoveryJob.update({
    where: { id: queued.id },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      attemptCount: { increment: 1 },
      lastError: null,
    },
  });

  try {
    const candidates = await buildLeadCandidates(queued.query, queued.state, queued.region);

    if (candidates.length === 0) {
      await db.leadDiscoveryJob.update({
        where: { id: queued.id },
        data: {
          status: "DONE",
          finishedAt: new Date(),
          resultCount: 0,
          lastError: process.env.SERPER_API_KEY
            ? "No matching companies found for this query."
            : "SERPER_API_KEY not configured. Set it in environment variables to enable web search.",
        },
      });
      return Response.json({
        message: process.env.SERPER_API_KEY
          ? "No matching companies found for this query."
          : "SERPER_API_KEY not configured.",
      });
    }
    let createdCount = 0;

    for (const candidate of candidates) {
      const existing = await db.leadCandidate.findFirst({
        where: {
          OR: [
            ...(candidate.dedupeKey ? [{ dedupeKey: candidate.dedupeKey }] : []),
            {
              companyName: candidate.companyName,
              state: candidate.state,
              region: candidate.region,
              status: { in: ["NEW", "REVIEWED", "PROMOTED"] },
            },
          ],
        },
      });

      if (existing) {
        continue;
      }

      await db.leadCandidate.create({
        data: {
          discoveryJobId: queued.id,
          ...candidate,
        },
      });

      createdCount += 1;
    }

    const job = await db.leadDiscoveryJob.update({
      where: { id: queued.id },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        resultCount: createdCount,
      },
    });

    return Response.json({
      data: job,
      message: `Processed one discovery job and created ${createdCount} candidates`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await db.leadDiscoveryJob.update({
      where: { id: queued.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        lastError: message,
      },
    });

    return Response.json({ error: "Failed to process discovery job", details: message }, { status: 500 });
  }
}
