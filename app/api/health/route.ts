import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    await db.$queryRaw(Prisma.sql`SELECT 1`);
    return Response.json({ ok: true, db: "connected" });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json({ ok: false, db: "disconnected" }, { status: 500 });
  }
}
