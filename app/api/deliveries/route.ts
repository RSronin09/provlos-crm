import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse, parsePositiveInt } from "@/lib/api";
import { deliveryCreateSchema } from "@/lib/crm-validation";
import { suggestDriver } from "@/lib/delivery-queue";
import { DeliveryStatus, DeliveryPriority } from "@prisma/client";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as DeliveryStatus | null;
  const priority = searchParams.get("priority") as DeliveryPriority | null;
  const driverId = searchParams.get("driverId");
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 50, 200);

  const where = {
    ...(status ? { status } : {}),
    ...(priority ? { priorityLevel: priority } : {}),
    ...(driverId === "unassigned"
      ? { assignedDriverId: null }
      : driverId
      ? { assignedDriverId: driverId }
      : {}),
  };

  const [deliveries, total] = await Promise.all([
    db.delivery.findMany({
      where,
      include: {
        customer: { select: { id: true, companyName: true } },
        assignedDriver: { select: { id: true, name: true } },
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

  // Auto-suggest driver if not provided
  const driverId = assignedDriverId ?? (await suggestDriver());

  const delivery = await db.$transaction(async (tx) => {
    const created = await tx.delivery.create({
      data: {
        ...rest,
        assignedDriverId: driverId,
        status: driverId ? "assigned" : "pending",
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
