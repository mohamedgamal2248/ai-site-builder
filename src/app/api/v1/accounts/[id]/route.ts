import type { NextRequest } from "next/server";
import { getAccountSummary } from "@/lib/account-summary";
import { apiError, apiJson, apiNet, apiOptions } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toUpperCase();
  if (!/^G[A-Z2-7]{55}$/.test(id)) return apiJson({ error: "bad account id" }, 60, 400);
  try {
    return apiJson(await getAccountSummary(apiNet(req), id), 15);
  } catch (e) {
    return apiError(e);
  }
}
