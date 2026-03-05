import { unauthorizedResponse, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { enqueueSchema } from "@/lib/crm-validation";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const parsed = enqueueSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { accountId, jobType, filters } = parsed.data;
  if (accountId) {
    const job = await db.enrichmentJob.create({
      data: {
        accountId,
        jobType,
      },
    });

    await db.account.update({
      where: { id: accountId },
      data: { enrichmentStatus: "QUEUED" },
    });

    return Response.json({ data: [job], count: 1 }, { status: 201 });
  }

  const accounts = await db.account.findMany({
    where: {
      ...(filters?.stage ? { stage: filters.stage } : {}),
      ...(filters?.state
        ? { state: { equals: filters.state, mode: "insensitive" as const } }
        : {}),
      ...(filters?.enrichmentStatus ? { enrichmentStatus: filters.enrichmentStatus } : {}),
      ...(filters?.region
        ? { region: { equals: filters.region, mode: "insensitive" as const } }
        : {}),
    },
    select: { id: true },
  });

  if (!accounts.length) {
    return Response.json({ data: [], count: 0 }, { status: 200 });
  }

  const created = await db.enrichmentJob.createMany({
    data: accounts.map((account) => ({
      accountId: account.id,
      jobType,
    })),
  });

  await db.account.updateMany({
    where: { id: { in: accounts.map((account) => account.id) } },
    data: { enrichmentStatus: "QUEUED" },
  });

  return Response.json({ count: created.count }, { status: 201 });
}
