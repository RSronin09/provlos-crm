import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse, uuidSchema } from "@/lib/api";
import { deliveryIssueResolveSchema } from "@/lib/crm-validation";
import { DeliveryStatus, IssueStatus } from "@prisma/client";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string; issueId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const { id: deliveryId, issueId } = await params;
  if (!uuidSchema.safeParse(issueId).success) {
    return Response.json({ error: "Invalid issue ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = deliveryIssueResolveSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const resolvedStatus = parsed.data.status ?? IssueStatus.resolved;

  const issue = await db.$transaction(async (tx) => {
    const updated = await tx.deliveryIssue.update({
      where: { id: issueId },
      data: {
        status: resolvedStatus,
        resolvedBy: parsed.data.resolvedBy,
        resolveNote: parsed.data.resolveNote ?? null,
        resolvedAt: new Date(),
      },
    });

    // If this was the last open issue on the delivery, move the delivery out
    // of "issue_reported" back to whatever status it had before the issue
    // was raised — otherwise it stays stuck on "Issue Reported" forever.
    if (resolvedStatus === IssueStatus.resolved) {
      const remainingOpenIssues = await tx.deliveryIssue.count({
        where: { deliveryId, status: IssueStatus.open },
      });

      if (remainingOpenIssues === 0) {
        const delivery = await tx.delivery.findUnique({ where: { id: deliveryId } });
        if (delivery && delivery.status === DeliveryStatus.issue_reported) {
          const lastIssueTransition = await tx.deliveryStatusHistory.findFirst({
            where: { deliveryId, newStatus: DeliveryStatus.issue_reported },
            orderBy: { changedAt: "desc" },
          });
          const revertStatus = lastIssueTransition?.oldStatus ?? DeliveryStatus.assigned;

          await tx.delivery.update({
            where: { id: deliveryId },
            data: { status: revertStatus },
          });
          await tx.deliveryStatusHistory.create({
            data: {
              deliveryId,
              oldStatus: DeliveryStatus.issue_reported,
              newStatus: revertStatus,
              changedBy: parsed.data.resolvedBy,
              note: "All issues resolved — delivery status restored.",
            },
          });
        }
      }
    }

    return updated;
  });

  return Response.json({ data: issue });
}
