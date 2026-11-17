import type { NextRequest } from "next/server";
import { apiError, apiJson, apiNet, apiOptions } from "@/lib/api";
import { horizon } from "@/lib/horizon";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET(req: NextRequest, { params }: { params: Promise<{ seq: string }> }) {
  const seq = Number((await params).seq);
  if (!Number.isInteger(seq) || seq < 1) return apiJson({ error: "bad ledger number" }, 60, 400);
  try {
    const net = apiNet(req);
    const [l, txs] = await Promise.all([horizon.ledger(net, seq), horizon.ledgerTransactions(net, seq, { limit: 200 })]);
    return apiJson(
      {
        sequence: l.sequence,
        hash: l.hash,
        prev_hash: l.prev_hash,
        closed_at: l.closed_at,
        transactions: l.successful_transaction_count,
        failed_transactions: l.failed_transaction_count,
        operations: l.operation_count,
        total_coins: l.total_coins,
        fee_pool: l.fee_pool,
        protocol_version: l.protocol_version,
        transaction_hashes: txs.records.map((t) => t.hash),
      },
      86400,
    );
  } catch (e) {
    return apiError(e);
  }
}
