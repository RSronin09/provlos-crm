"use client";

import { useAutoRefresh } from "@/lib/use-auto-refresh";

/**
 * Drop this anywhere inside a server-rendered page to enable automatic
 * polling via router.refresh(). Renders nothing visible.
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  useAutoRefresh(intervalMs);
  return null;
}
