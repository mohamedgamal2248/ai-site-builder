import { dictionaries, type Lang } from "./i18n";
import type { Network } from "./horizon";

/**
 * Pages live under one hidden path segment, e.g. "ar-main" or "en-test~cursor=123&dir=asc".
 * The middleware builds it from the lang/net cookies and the allowed query keys, so every
 * combination is its own cached static page on the CDN while visible URLs stay the same.
 */
export const BASE_SEGMENTS = ["ar-main", "en-main", "ar-test", "en-test"] as const;
export const QUERY_KEYS = ["cursor", "dir", "code", "min", "muxed", "range", "tab", "type"] as const;

export type Theme = "auto" | "light" | "dark";
export type Query = Record<string, string | undefined>;

export function parseSegment(raw: string) {
  let seg = raw;
  try {
    if (seg.includes("%")) seg = decodeURIComponent(seg);
  } catch {
    /* keep raw */
  }
  const i = seg.indexOf("~");
  const base = i < 0 ? seg : seg.slice(0, i);
  const q: Query = {};
  if (i >= 0) {
    for (const [k, v] of new URLSearchParams(seg.slice(i + 1))) if ((QUERY_KEYS as readonly string[]).includes(k)) q[k] = v;
  }
  const [l, n] = base.split("-");
  const lang: Lang = l === "en" ? "en" : "ar";
  const net: Network = n === "test" ? "testnet" : "mainnet";
  return { lang, net, q };
}

export async function getSettings(params: Promise<{ s: string }> | { s: string }) {
  const { s } = await params;
  const { lang, net, q } = parseSegment(s);
  return { lang, net, q, t: dictionaries[lang], native: net === "testnet" ? "Test-Pi" : "Pi", seg: s };
}

export type Settings = Awaited<ReturnType<typeof getSettings>>;
