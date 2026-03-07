import { unauthorizedResponse, uuidSchema, zodErrorResponse } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { AccountStage, ActivityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

const moveStageSchema = z.object({
  toStage: z.nativeEnum(AccountStage),
  note: z.string().min(1, "Note is required for stage changes"),
  noteFrom: z.string().min(1, "Name is required for stage changes"),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid account id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = moveStageSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const account = await db.account.findUnique({ where: { id } });
  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  const { toStage, note, noteFrom } = parsed.data;
  if (account.stage === toStage) {
    return Response.json({ error: "Account is already in this stage" }, { status: 400 });
  }

  const movedAt = new Date();

  const [updatedAccount] = await db.$transaction([
    db.account.update({
      where: { id },
      data: { stage: toStage },
    }),
    db.activity.create({
      data: {
        accountId: id,
        type: ActivityType.NOTE,
        content:
          `Pipeline stage moved from ${account.stage} to ${toStage}.\n` +
          `Date: ${movedAt.toISOString().slice(0, 10)}\n` +
          `Note from: ${noteFrom.trim()}\n` +
          `Note: ${note.trim()}`,
      },
    }),
  ]);

  return Response.json({ data: updatedAccount });
}
