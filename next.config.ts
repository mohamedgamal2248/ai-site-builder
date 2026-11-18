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

/*
 * Security headers. The CSP allows only this site plus the APIs the browser talks to directly
 * (Pi Horizon for live data, OKX for the price). 'unsafe-inline' is needed because pages are
 * static, cached HTML (no per-request nonce); no third-party script hosts are allowed.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.mainnet.minepi.com https://api.testnet.minepi.com https://www.okx.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const security = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

nextConfig.headers = async () => [
  // Everything except the embeddable widget may not be framed by other sites.
  { source: "/((?!embed).*)", headers: [...security, { key: "Content-Security-Policy", value: `${CSP}; frame-ancestors 'none'` }, { key: "X-Frame-Options", value: "DENY" }] },
  { source: "/embed", headers: [...security, { key: "Content-Security-Policy", value: `${CSP}; frame-ancestors *` }] },
];

export default nextConfig;
