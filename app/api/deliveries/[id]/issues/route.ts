import { db } from "@/lib/db";
import { zodErrorResponse, uuidSchema } from "@/lib/api";
import { deliveryIssueCreateSchema } from "@/lib/crm-validation";
import { DeliveryStatus } from "@prisma/client";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const issues = await db.deliveryIssue.findMany({
    where: { deliveryId: id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ data: issues });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = deliveryIssueCreateSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await db.$transaction(async (tx) => {
    const issue = await tx.deliveryIssue.create({
      data: {
        deliveryId: id,
        reportedBy: parsed.data.reportedBy,
        issueType: parsed.data.issueType,
        note: parsed.data.note ?? null,
      },
    });

    // Auto-transition delivery status to issue_reported
    const existing = await tx.delivery.findUnique({ where: { id } });
    if (existing && existing.status !== DeliveryStatus.issue_reported) {
      await tx.delivery.update({
        where: { id },
        data: { status: DeliveryStatus.issue_reported },
      });
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: id,
          oldStatus: existing.status,
          newStatus: DeliveryStatus.issue_reported,
          changedBy: parsed.data.reportedBy,
          note: `Issue reported: ${parsed.data.issueType}`,
        },
      });
    }

    return issue;
  });

  return Response.json({ data: result }, { status: 201 });
}
