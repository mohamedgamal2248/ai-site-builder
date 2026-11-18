import type { MetadataRoute } from "next";
import { guides } from "@/data/guides";
import { knownWallets } from "@/data/wallets";

const BASE = process.env.SITE_URL || "https://ai-site-builder-peach.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "blocks", "txs", "operations", "stats", "flows", "whales", "supply", "unlocks", "largest", "locked", "wallets", "richlist", "assets", "pools", "trades", "api-docs", "status", "pressure", "pressure/accuracy", "alerts", "radar", "whale-tracker", "depth", "report", "report/week", "growth", "news", "learn", "widgets", ...guides.map((g) => `learn/${g.slug}`)];
  const now = new Date();
  return [
    ...pages.map((p) => ({ url: `${BASE}/${p}`, lastModified: now, changeFrequency: "always" as const, priority: p ? 0.7 : 1 })),
    ...knownWallets.map((w) => ({ url: `${BASE}/account/${w.address}`, lastModified: now, changeFrequency: "hourly" as const, priority: 0.6 })),
  ];
}
