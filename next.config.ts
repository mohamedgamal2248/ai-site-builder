import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Keep visited pages in the browser's router cache so going back, or re-opening
    // a block or transaction you just saw, is instant.
    staleTimes: { dynamic: 30, static: 300 },
  },
};

export default nextConfig;
