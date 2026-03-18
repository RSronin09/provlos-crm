import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse, uuidSchema } from "@/lib/api";
import { deliveryIssueResolveSchema } from "@/lib/crm-validation";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string; issueId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const { issueId } = await params;
  if (!uuidSchema.safeParse(issueId).success) {
    return Response.json({ error: "Invalid issue ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = deliveryIssueResolveSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const issue = await db.deliveryIssue.update({
    where: { id: issueId },
    data: {
      status: parsed.data.status ?? "resolved",
      resolvedBy: parsed.data.resolvedBy,
      resolveNote: parsed.data.resolveNote ?? null,
      resolvedAt: new Date(),
    },
  });

  return Response.json({ data: issue });
}
