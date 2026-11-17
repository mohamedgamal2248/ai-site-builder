import { canonicalAssetLabel, lockOwner } from "./format";
import type { Ledger, Network, Operation } from "./horizon";

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

/** Builds the home-page snapshot from raw Horizon records (newest first). Pure, so the browser can use it too. */
export function buildLatest(net: Network, ledgers: Ledger[], ops: Operation[], native = net === "testnet" ? "Test-Pi" : "Pi"): Latest {
  const spark: SparkPoint[] = ledgers
    .slice(0, 50)
    .map((l, i) => {
      const prev = ledgers[i + 1];
      return {
        seq: l.sequence,
        txs: l.successful_transaction_count + l.failed_transaction_count,
        ops: l.operation_count,
        secs: prev ? Math.max(0, (Date.parse(l.closed_at) - Date.parse(prev.closed_at)) / 1000) : 5,
      };
    })
    .reverse();
  return {
    net,
    ledgers: ledgers.slice(0, 10).map((l) => ({
      sequence: l.sequence,
      closed_at: l.closed_at,
      txs: l.successful_transaction_count,
      failed: l.failed_transaction_count,
      ops: l.operation_count,
    })),
    activity: ops.map((o) => toActivity(o, native)),
    spark,
  };
}

/* ---------- Live updates (applied in the browser as stream records arrive) ---------- */

export function withLedger(latest: Latest, l: Ledger): Latest {
  if (latest.ledgers.some((x) => x.sequence === l.sequence)) return latest;
  const prev = latest.ledgers[0];
  const row: LatestLedger = { sequence: l.sequence, closed_at: l.closed_at, txs: l.successful_transaction_count, failed: l.failed_transaction_count, ops: l.operation_count };
  const secs = prev ? Math.max(0, (Date.parse(l.closed_at) - Date.parse(prev.closed_at)) / 1000) : 5;
  return {
    ...latest,
    ledgers: [row, ...latest.ledgers].slice(0, 10),
    spark: [...latest.spark, { seq: l.sequence, txs: row.txs + row.failed, ops: row.ops, secs }].slice(-50),
  };
}

export function withOperations(latest: Latest, ops: Operation[], native: string): Latest {
  const seen = new Set(latest.activity.map((a) => a.id));
  const fresh = ops.filter((o) => !seen.has(o.id)).reverse().map((o) => toActivity(o, native));
  if (!fresh.length) return latest;
  return { ...latest, activity: [...fresh, ...latest.activity].slice(0, 40) };
}
