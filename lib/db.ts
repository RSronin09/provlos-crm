import { PrismaClient } from "@prisma/client";

// Prisma will throw "Environment variable not found: DATABASE_URL" at query time
// if this isn't set. The error.tsx boundary converts that to a friendly message.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "test") {
  console.error(
    "[db] DATABASE_URL is not set. Set it in .env (local) or " +
      "Vercel Project Settings → Environment Variables (production).",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
