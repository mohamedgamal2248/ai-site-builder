import type { NextRequest } from "next/server";
import { apiError, apiJson, apiNet, apiOptions } from "@/lib/api";
import { getUnlocks, statsEnabled } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET(req: NextRequest) {
  if (!statsEnabled()) return apiJson({ error: "statistics are not enabled on this deployment" }, 60, 503);
  try {
    return apiJson(await getUnlocks(apiNet(req), 24), 300);
  } catch (e) {
    return apiError(e);
  }
}
