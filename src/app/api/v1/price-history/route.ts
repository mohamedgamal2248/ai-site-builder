import type { NextRequest } from "next/server";
import { apiJson, apiOptions } from "@/lib/api";
import { getCandles, type PriceRange } from "@/lib/price";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET(req: NextRequest) {
  const r = req.nextUrl.searchParams.get("range");
  const range: PriceRange = r === "24h" || r === "30d" ? r : "7d";
  return apiJson({ pair: "PI-USDT", source: "OKX", range, points: await getCandles(range) }, 120);
}
