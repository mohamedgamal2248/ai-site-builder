import { NextResponse, type NextRequest } from "next/server";

/*
 * 1. Pages: rewrite /path?cursor=… to /<lang>-<net>~cursor=…/path using the lang/net cookies,
 *    so each page is a static, CDN-cached file per language/network/query (no server render
 *    per visit). Only known query keys are kept, so tracking tags cannot split the cache.
 * 2. Public JSON API: light rate limit (60 requests a minute per IP, per instance).
 */
const KEYS = new Set(["cursor", "dir", "code", "min", "muxed", "range", "tab", "type"]);
const SEG = /^(ar|en)-(main|test)(~|$)/;

const WINDOW = 60_000;
const LIMIT = 60;
const hits = new Map<string, { n: number; reset: number }>();

function rateLimit(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + WINDOW });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return NextResponse.next();
  }
  h.n++;
  if (h.n > LIMIT) {
    return NextResponse.json(
      { error: "rate limit: 60 requests per minute" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((h.reset - now) / 1000)), "Access-Control-Allow-Origin": "*" } },
    );
  }
  return NextResponse.next();
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (pathname.startsWith("/api/")) return rateLimit(req);

  const first = pathname.split("/")[1] ?? "";
  let decoded = first;
  try {
    decoded = decodeURIComponent(first);
  } catch {
    /* ignore */
  }
  if (SEG.test(decoded)) return NextResponse.next();

  const lang = req.cookies.get("lang")?.value === "en" ? "en" : "ar";
  const net = req.cookies.get("net")?.value === "testnet" ? "test" : "main";
  const q = new URLSearchParams();
  for (const [k, v] of searchParams) if (KEYS.has(k) && v && v.length <= 120 && !q.has(k)) q.set(k, v);
  q.sort();
  const qs = q.toString();
  const seg = `${lang}-${net}${qs ? `~${qs}` : ""}`;

  const url = req.nextUrl.clone();
  url.pathname = `/${encodeURIComponent(seg)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

// Real files (public/ and generated metadata files) are left alone; any other path, including a
// missing file like /old.png, goes to the pages so it gets the site's 404 page.
export const config = {
  matcher: ["/api/v1/:path*", "/((?!api/|_next/|search$|settings$|sitemap\\.xml$|robots\\.txt$|manifest\\.webmanifest$|sw\\.js$|icon\\.svg$|icons/).*)"],
};
