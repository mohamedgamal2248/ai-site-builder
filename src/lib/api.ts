import { NextResponse, type NextRequest } from "next/server";
import { HorizonError, type Network } from "./horizon";

export function apiNet(req: NextRequest): Network {
  return req.nextUrl.searchParams.get("net") === "testnet" ? "testnet" : "mainnet";
}

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

/** JSON response with CORS and a shared CDN cache. */
export function apiJson(data: unknown, sMaxAge: number, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { ...CORS, "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 4}` },
  });
}

export function apiError(e: unknown) {
  if (e instanceof HorizonError && (e.status === 404 || e.status === 400)) {
    return NextResponse.json({ error: "not found" }, { status: 404, headers: CORS });
  }
  return NextResponse.json({ error: "upstream unavailable" }, { status: 502, headers: { ...CORS, "Cache-Control": "no-store" } });
}

export function apiOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
