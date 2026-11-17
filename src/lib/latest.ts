import { canonicalAssetLabel, lockOwner } from "./format";
import { horizon, type Network, type Operation } from "./horizon";

export interface LatestLedger {
  sequence: number;
  closed_at: string;
  txs: number;
  failed: number;
  ops: number;
}

export type ActivityKind = "payment" | "lock" | "claim" | "create" | "other";

export interface Activity {
  id: string;
  kind: ActivityKind;
  type: string;
  tx: string;
  at: string;
  from?: string;
  to?: string;
  amount?: string;
  asset?: string;
  ok: boolean;
}

export interface SparkPoint {
  seq: number;
  txs: number;
  ops: number;
  /** Seconds since the previous ledger closed. */
  secs: number;
}

export interface Latest {
  net: Network;
  ledgers: LatestLedger[];
  activity: Activity[];
  spark: SparkPoint[];
}

const s = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Flattens an operation into one activity row with a kind the home page can filter on. */
export function toActivity(op: Operation, native = "Pi"): Activity {
  const base = { id: op.id, type: op.type, tx: op.transaction_hash, at: op.created_at, ok: op.transaction_successful !== false };
  const asset = (prefix = "") =>
    s(op[`${prefix}asset_type`]) === "native" ? native : s(op[`${prefix}asset_code`]) ?? native;
  switch (op.type) {
    case "payment":
      return { ...base, kind: "payment", from: s(op.from), to: s(op.to), amount: s(op.amount), asset: asset() };
    case "path_payment_strict_receive":
    case "path_payment_strict_send":
      return { ...base, kind: "payment", from: s(op.from), to: s(op.to), amount: s(op.amount), asset: asset() };
    case "create_account":
      return { ...base, kind: "create", from: s(op.funder), to: s(op.account), amount: s(op.starting_balance), asset: native };
    case "create_claimable_balance": {
      const claimants = Array.isArray(op.claimants) ? (op.claimants as { destination: string; predicate: never }[]) : [];
      return {
        ...base,
        kind: "lock",
        from: op.source_account,
        to: lockOwner(claimants)?.destination,
        amount: s(op.amount),
        asset: canonicalAssetLabel(s(op.asset) ?? "native", native),
      };
    }
    case "claim_claimable_balance":
      return { ...base, kind: "claim", from: s(op.claimant) ?? op.source_account };
    default:
      return { ...base, kind: "other", from: op.source_account };
  }
}

/** Snapshot for the home page and the /api/latest poller: 50 ledgers (sparklines), 40 operations. */
export async function getLatest(net: Network, native = net === "testnet" ? "Test-Pi" : "Pi", fresh = false): Promise<Latest> {
  const [ledgers, ops] = await Promise.all([
    fresh ? horizon.ledgersFresh(net, 51) : horizon.ledgers(net, { limit: 51 }),
    fresh ? horizon.operationsFresh(net, 40) : horizon.operations(net, { limit: 40 }),
  ]);
  const recs = ledgers.records;
  const spark: SparkPoint[] = recs.slice(0, 50).map((l, i) => {
    const prev = recs[i + 1];
    return {
      seq: l.sequence,
      txs: l.successful_transaction_count + l.failed_transaction_count,
      ops: l.operation_count,
      secs: prev ? Math.max(0, (Date.parse(l.closed_at) - Date.parse(prev.closed_at)) / 1000) : 5,
    };
  }).reverse();
  return {
    net,
    ledgers: recs.slice(0, 10).map((l) => ({
      sequence: l.sequence,
      closed_at: l.closed_at,
      txs: l.successful_transaction_count,
      failed: l.failed_transaction_count,
      ops: l.operation_count,
    })),
    activity: ops.records.map((o) => toActivity(o, native)),
    spark,
  };
}
