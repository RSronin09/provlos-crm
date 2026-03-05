import { unauthorizedResponse, uuidSchema, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { LeadCandidateStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

const candidateUpdateSchema = z.object({
  status: z.nativeEnum(LeadCandidateStatus).optional(),
  notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid candidate id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = candidateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const updated = await db.leadCandidate.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ data: updated });
}
