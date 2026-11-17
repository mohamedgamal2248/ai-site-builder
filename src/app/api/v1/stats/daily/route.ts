import type { NextRequest } from "next/server";
import { apiError, apiJson, apiNet, apiOptions } from "@/lib/api";
import { getDaily, statsEnabled } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET(req: NextRequest) {
  if (!statsEnabled()) return apiJson({ error: "statistics are not enabled on this deployment" }, 60, 503);
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 366);
  try {
    return apiJson(await getDaily(apiNet(req), days), 60);
  } catch (e) {
    return apiError(e);
  }
}
