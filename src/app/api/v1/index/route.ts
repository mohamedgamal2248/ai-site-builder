import { NextResponse } from "next/server";
import { getIndex } from "@/lib/insights";
import { statsEnabled } from "@/lib/stats";

export const revalidate = 300;

/** The current Pi Pressure Index (0–100), cached for 5 minutes at the CDN. */
export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", "Access-Control-Allow-Origin": "*" };
  if (!statsEnabled()) return NextResponse.json({ score: null, band: null }, { headers });
  const idx = await getIndex("mainnet").catch(() => null);
  return NextResponse.json({ score: idx?.score ?? null, band: idx?.band ?? null, at: idx?.at ?? null, disclaimer: "Informational only, not investment advice." }, { headers });
}
