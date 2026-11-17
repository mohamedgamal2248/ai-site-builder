import { NextResponse, type NextRequest } from "next/server";

/**
 * Light rate limit for the public JSON API: 60 requests a minute per IP, per server instance.
 * Not a hard guarantee across instances, but it stops a single client hammering the site.
 */
const WINDOW = 60_000;
const LIMIT = 60;
const hits = new Map<string, { n: number; reset: number }>();

export function middleware(req: NextRequest) {
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

export const config = { matcher: "/api/v1/:path*" };
