import type { NextRequest } from "next/server";
import { apiError, apiJson, apiNet, apiOptions } from "@/lib/api";
import { getLargest, statsEnabled } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

const HOURS: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };

export async function GET(req: NextRequest) {
  if (!statsEnabled()) return apiJson({ error: "statistics are not enabled on this deployment" }, 60, 503);
  const hours = HOURS[req.nextUrl.searchParams.get("range") ?? "24h"] ?? 24;
  try {
    return apiJson(await getLargest(apiNet(req), hours, 50), 60);
  } catch (e) {
    return apiError(e);
  }
}
