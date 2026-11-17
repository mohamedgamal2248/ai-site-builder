import { NextResponse, type NextRequest } from "next/server";
import { getLatest } from "@/lib/latest";

/** Shared by every open home page: the CDN answers most polls, Horizon sees a few per minute. */
export async function GET(req: NextRequest) {
  const net = req.nextUrl.searchParams.get("net") === "testnet" ? "testnet" : "mainnet";
  try {
    const data = await getLatest(net);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=4, stale-while-revalidate=10" },
    });
  } catch {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
