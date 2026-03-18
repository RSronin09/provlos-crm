import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse, parsePositiveInt } from "@/lib/api";
import { deliveryCreateSchema } from "@/lib/crm-validation";
import { suggestDriver, TERMINAL_STATUSES } from "@/lib/delivery-queue";
import { DeliveryStatus, DeliveryPriority, IssueStatus } from "@prisma/client";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as DeliveryStatus | null;
  const priority = searchParams.get("priority") as DeliveryPriority | null;
  const driverId = searchParams.get("driverId");
  const customerId = searchParams.get("customerId");
  const hasIssue = searchParams.get("hasIssue") === "true";
  const overdueOnly = searchParams.get("overdueOnly") === "true";
  const unassignedOnly = searchParams.get("unassignedOnly") === "true";
  const openOnly = searchParams.get("openOnly") === "true";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 50, 200);

  const now = new Date();

  const where = {
    ...(status ? { status } : {}),
    ...(priority ? { priorityLevel: priority } : {}),
    ...(driverId === "unassigned"
      ? { assignedDriverId: null }
      : driverId
      ? { assignedDriverId: driverId }
      : {}),
    ...(customerId ? { customerId } : {}),
    ...(unassignedOnly ? { assignedDriverId: null } : {}),
    ...(openOnly ? { status: { notIn: TERMINAL_STATUSES } } : {}),
    ...(overdueOnly
      ? {
          status: { notIn: TERMINAL_STATUSES },
          requestedDeliveryDateTime: { lt: now },
        }
      : {}),
    ...(hasIssue ? { issues: { some: { status: IssueStatus.open } } } : {}),
    ...(dateFrom || dateTo
      ? {
          requestedDeliveryDateTime: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  const [deliveries, total] = await Promise.all([
    db.delivery.findMany({
      where,
      include: {
        customer: { select: { id: true, companyName: true } },
        assignedDriver: { select: { id: true, name: true } },
        issues: { where: { status: "open" }, select: { id: true, issueType: true } },
      },
      orderBy: [
        { priorityLevel: "desc" },
        { requestedDeliveryDateTime: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.delivery.count({ where }),
  ]);

  return Response.json({
    data: deliveries,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const body = await request.json();
  const parsed = deliveryCreateSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { assignedDriverId, ...rest } = parsed.data;
  const driverId = assignedDriverId ?? (await suggestDriver());

  const delivery = await db.$transaction(async (tx) => {
    const created = await tx.delivery.create({
      data: {
        ...rest,
        assignedDriverId: driverId,
        status: driverId ? "assigned" : "pending",
        ...(driverId ? { assignedAt: new Date() } : {}),
      },
      include: {
        customer: { select: { id: true, companyName: true } },
        assignedDriver: { select: { id: true, name: true } },
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: created.id,
        oldStatus: null,
        newStatus: created.status,
        changedBy: parsed.data.createdBy,
        note: "Delivery created",
      },
    });

    return created;
  });

  return Response.json({ data: delivery }, { status: 201 });
}
