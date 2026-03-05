import { z } from "zod";

export const uuidSchema = z.string().uuid();

export function parsePositiveInt(
  value: string | null,
  fallback: number,
  max = 200,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function zodErrorResponse(error: z.ZodError) {
  return Response.json(
    {
      error: "Validation failed",
      details: error.flatten(),
    },
    { status: 400 },
  );
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
