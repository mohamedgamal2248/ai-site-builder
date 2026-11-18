import type { MetadataRoute } from "next";

const BASE = process.env.SITE_URL || "https://blockchainpi.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/settings", "/search"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
