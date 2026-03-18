import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { zodErrorResponse, unauthorizedResponse } from "@/lib/api";
import { driverCreateSchema } from "@/lib/crm-validation";
import { NextRequest } from "next/server";
import { DeliveryStatus } from "@prisma/client";

export async function GET(_request: NextRequest) {
  const drivers = await db.driver.findMany({
    include: {
      _count: {
        select: {
          deliveries: {
            where: {
              status: {
                in: [
                  DeliveryStatus.assigned,
                  DeliveryStatus.en_route_to_pickup,
                  DeliveryStatus.picked_up,
                  DeliveryStatus.en_route_to_delivery,
                ],
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return Response.json({ data: drivers });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const body = await request.json();
  const parsed = driverCreateSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const driver = await db.driver.create({ data: parsed.data });
  return Response.json({ data: driver }, { status: 201 });
}
