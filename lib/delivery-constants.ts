/**
 * Shared, client-safe delivery constants.
 *
 * This file must NOT import "@/lib/db" (or anything else server-only) because
 * it is imported directly by client components (e.g. live-operations-panel)
 * that recompute "at risk" locally between server refreshes. Keeping the
 * threshold here — instead of duplicating the number in each component —
 * ensures the server-rendered value and the client's 30s polling refresh
 * always agree on what counts as "at risk".
 */
export const AT_RISK_WINDOW_HOURS = 2;
