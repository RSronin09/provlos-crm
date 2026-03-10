import { unauthorizedResponse, uuidSchema } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid candidate id" }, { status: 400 });
  }

  const candidate = await db.leadCandidate.findUnique({
    where: { id },
  });

  if (!candidate) {
    return Response.json({ error: "Lead candidate not found" }, { status: 404 });
  }

  const account = await db.account.findFirst({
    where: {
      OR: [
        ...(candidate.website ? [{ website: candidate.website }] : []),
        {
          companyName: { equals: candidate.companyName, mode: "insensitive" },
          state: candidate.state,
        },
      ],
    },
  });

  const promotedAccount =
    account ??
    (await db.account.create({
      data: {
        companyName: candidate.companyName,
        website: candidate.website,
        state: candidate.state,
        region: candidate.region,
        notes: candidate.signalSummary ?? undefined,
        stage: "TARGET",
      },
    }));

  const updatedCandidate = await db.leadCandidate.update({
    where: { id: candidate.id },
    data: {
      accountId: promotedAccount.id,
      status: "PROMOTED",
    },
  });

  return Response.json({
    data: {
      candidate: updatedCandidate,
      account: promotedAccount,
    },
  });
}
