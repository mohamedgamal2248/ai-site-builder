import type { NextRequest } from "next/server";
import { apiError, apiJson, apiNet, apiOptions } from "@/lib/api";
import { horizon } from "@/lib/horizon";
import { toActivity } from "@/lib/latest";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET(req: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  const hash = (await params).hash.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return apiJson({ error: "bad transaction hash" }, 60, 400);
  try {
    const net = apiNet(req);
    const [tx, ops] = await Promise.all([horizon.transaction(net, hash), horizon.transactionOperations(net, hash)]);
    return apiJson(
      {
        hash: tx.hash,
        ledger: tx.ledger,
        created_at: tx.created_at,
        successful: tx.successful,
        source_account: tx.source_account,
        fee_charged_stroops: tx.fee_charged,
        memo_type: tx.memo_type,
        memo: tx.memo ?? null,
        operations: ops.records.map((o) => {
          const a = toActivity(o);
          return { id: o.id, type: o.type, kind: a.kind, from: a.from ?? null, to: a.to ?? null, amount: a.amount ?? null, asset: a.asset ?? null };
        }),
      },
      86400,
    );
  } catch (e) {
    return apiError(e);
  }
}
