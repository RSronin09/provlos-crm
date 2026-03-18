"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Calls router.refresh() at the given interval (ms) to re-fetch server component data.
 * Only runs when the tab is visible.
 */
export function useAutoRefresh(intervalMs: number = 30_000) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = () => {
      intervalRef.current = setInterval(() => {
        if (!document.hidden) {
          router.refresh();
        }
      }, intervalMs);
    };

    start();

    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        router.refresh();
        start();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router, intervalMs]);
}
