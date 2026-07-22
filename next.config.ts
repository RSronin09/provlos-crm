import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo sits inside a parent folder that has its own package-lock.json,
  // which makes Turbopack infer the wrong workspace root in local dev.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
