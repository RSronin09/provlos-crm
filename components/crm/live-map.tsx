"use client";

import dynamic from "next/dynamic";
import type { LiveMapProps } from "./live-map-inner";

const LiveMapInner = dynamic(() => import("./live-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

export function LiveMap(props: LiveMapProps) {
  return <LiveMapInner {...props} />;
}
