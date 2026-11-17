import { horizon, type Network } from "./horizon";

export interface LatestLedger {
  sequence: number;
  closed_at: string;
  txs: number;
  failed: number;
  ops: number;
}

export interface LatestTx {
  hash: string;
  ledger: number;
  created_at: string;
  source: string;
  ops: number;
  fee: string;
  ok: boolean;
}

export interface Latest {
  net: Network;
  ledgers: LatestLedger[];
  txs: LatestTx[];
}

/** Compact snapshot for the home page and the /api/latest poller. */
export async function getLatest(net: Network, n = 10): Promise<Latest> {
  const [ledgers, txs] = await Promise.all([
    horizon.ledgers(net, { limit: n }),
    horizon.transactions(net, { limit: n }),
  ]);
  return {
    net,
    ledgers: ledgers.records.map((l) => ({
      sequence: l.sequence,
      closed_at: l.closed_at,
      txs: l.successful_transaction_count,
      failed: l.failed_transaction_count,
      ops: l.operation_count,
    })),
    txs: txs.records.map((t) => ({
      hash: t.hash,
      ledger: t.ledger,
      created_at: t.created_at,
      source: t.source_account,
      ops: t.operation_count,
      fee: t.fee_charged,
      ok: t.successful,
    })),
  };
}
