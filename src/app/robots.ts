import type { MetadataRoute } from "next";

const BASE = process.env.SITE_URL || "https://ai-site-builder-peach.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/settings", "/search"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
