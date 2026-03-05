import { parsePositiveInt, zodErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { TaskStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

const taskFilterSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  dueBefore: z.coerce.date().optional(),
});

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = parsePositiveInt(params.get("page"), 1, 10_000);
  const pageSize = parsePositiveInt(params.get("pageSize"), 25, 200);

  const parsed = taskFilterSchema.safeParse({
    status: params.get("status") ?? undefined,
    dueBefore: params.get("dueBefore") ?? undefined,
  });

  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const where = {
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.dueBefore ? { dueAt: { lte: parsed.data.dueBefore } } : {}),
  };

  const [items, total] = await Promise.all([
    db.task.findMany({
      where,
      include: { account: true, contact: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.task.count({ where }),
  ]);

  return Response.json({
    data: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
