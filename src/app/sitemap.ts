import type { MetadataRoute } from "next";
import { guides } from "@/data/guides";
import { knownWallets } from "@/data/wallets";

const BASE = process.env.SITE_URL || "https://blockchainpi.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "blocks", "txs", "operations", "stats", "flows", "reserves", "compare", "whales", "supply", "unlocks", "largest", "locked", "wallets", "richlist", "assets", "pools", "trades", "api-docs", "status", "pressure", "pressure/accuracy", "alerts", "radar", "whale-tracker", "depth", "report", "report/week", "growth", "news", "learn", "widgets", ...guides.map((g) => `learn/${g.slug}`)];
  const now = new Date();
  // Every page twice: English at /path and Arabic at /ar/path, each pointing at the other.
  const both = (path: string, freq: "always" | "hourly", priority: number) => {
    const en = `${BASE}/${path}`.replace(/\/$/, "") || BASE;
    const ar = `${BASE}/ar${path ? `/${path}` : ""}`;
    const languages = { en, ar, "x-default": en };
    return [
      { url: en, lastModified: now, changeFrequency: freq, priority, alternates: { languages } },
      { url: ar, lastModified: now, changeFrequency: freq, priority, alternates: { languages } },
    ];
  };
  return [...pages.flatMap((p) => both(p, "always", p ? 0.7 : 1)), ...knownWallets.flatMap((w) => both(`account/${w.address}`, "hourly", 0.6))];
}
