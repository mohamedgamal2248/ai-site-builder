import type { NextRequest } from "next/server";
import { apiError, apiJson, apiNet, apiOptions } from "@/lib/api";
import { horizon } from "@/lib/horizon";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 20, 1), 100);
  try {
    const page = await horizon.ledgers(apiNet(req), { limit });
    return apiJson(
      page.records.map((l) => ({
        sequence: l.sequence,
        hash: l.hash,
        closed_at: l.closed_at,
        transactions: l.successful_transaction_count,
        failed_transactions: l.failed_transaction_count,
        operations: l.operation_count,
      })),
      5,
    );
  } catch (e) {
    return apiError(e);
  }
}
