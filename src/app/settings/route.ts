import { NextResponse, type NextRequest } from "next/server";

const ALLOWED: Record<string, string[]> = { lang: ["ar", "en"], net: ["mainnet", "testnet"] };

/** Switches language or network with a cookie, then returns the visitor to the page they were on. */
export function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("k") ?? "";
  const v = req.nextUrl.searchParams.get("v") ?? "";

  let back = "/";
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.host === req.nextUrl.host) back = u.pathname + u.search;
    } catch {
      /* ignore bad referer */
    }
  }
  // Switching network makes ledger/tx/account pages meaningless, so go home.
  if (k === "net") back = "/";

  const res = NextResponse.redirect(new URL(back, req.url), 303);
  if (ALLOWED[k]?.includes(v)) {
    res.cookies.set(k, v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}
