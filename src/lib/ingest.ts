/**
 * Statistics indexer. Reads Pi's Horizon API in ascending pages and keeps
 * small aggregate tables in Postgres up to date. Each page and its cursor are
 * written in one transaction, so a crash never double-counts.
 *
 * Imports are relative so the same code runs from Next routes and from `tsx scripts/ingest.ts`.
 */
import type postgres from "postgres";
import type { Sql } from "./db";
import { lockOwner, unlockTime } from "./format";
import { horizonHost, type ClaimableBalance, type Ledger, type Network, type Operation } from "./horizon";

const PAGE = 200;
export const STREAMS = ["ledgers", "operations", "claimable"] as const;
export type Stream = (typeof STREAMS)[number];

export function largeThreshold() {
  const n = Number(process.env.LARGE_PAYMENT_MIN || 10000);
  return Number.isFinite(n) && n > 0 ? n : 10000;
}

async function fetchRecords<T>(net: Network, path: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(path, horizonHost(net));
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return ((await res.json()) as { _embedded: { records: T[] } })._embedded.records;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    throw new Error(`Horizon ${res.status} for ${url.pathname}`);
  }
}

const PATHS: Record<Stream, { path: string; params: Record<string, string> }> = {
  ledgers: { path: "/ledgers", params: {} },
  operations: { path: "/operations", params: {} },
  claimable: { path: "/claimable_balances", params: { asset: "native" } },
};

/** Where a stream starts the first time: live streams from the newest record, lockups from the very beginning. */
async function initialCursor(net: Network, stream: Stream): Promise<string> {
  if (stream === "claimable") return "";
  const latest = await fetchRecords<{ paging_token: string }>(net, PATHS[stream].path, { order: "desc", limit: "1" });
  return latest[0]?.paging_token ?? "";
}

async function loadCursor(sql: Sql, net: Network, stream: Stream) {
  const rows = await sql<{ cursor: string }[]>`select cursor from sync_state where net = ${net} and stream = ${stream}`;
  if (rows.length) return rows[0].cursor;
  const cursor = await initialCursor(net, stream);
  await sql`insert into sync_state (net, stream, cursor) values (${net}, ${stream}, ${cursor}) on conflict do nothing`;
  return cursor;
}

type DayAgg = {
  ledgers: number; txs: number; failed_txs: number; ops: number; payments: number;
  payment_volume: number; new_accounts: number; locks_created: number; locked_amount: number; claims: number;
};
const emptyDay = (): DayAgg => ({
  ledgers: 0, txs: 0, failed_txs: 0, ops: 0, payments: 0, payment_volume: 0, new_accounts: 0, locks_created: 0, locked_amount: 0, claims: 0,
});

async function addDays(tx: postgres.TransactionSql, net: Network, days: Map<string, DayAgg>) {
  for (const [day, d] of days) {
    await tx`
      insert into daily_stats ${tx({ net, day, ...d, payment_volume: d.payment_volume.toFixed(7), locked_amount: d.locked_amount.toFixed(7) })}
      on conflict (net, day) do update set
        ledgers = daily_stats.ledgers + excluded.ledgers,
        txs = daily_stats.txs + excluded.txs,
        failed_txs = daily_stats.failed_txs + excluded.failed_txs,
        ops = daily_stats.ops + excluded.ops,
        payments = daily_stats.payments + excluded.payments,
        payment_volume = daily_stats.payment_volume + excluded.payment_volume,
        new_accounts = daily_stats.new_accounts + excluded.new_accounts,
        locks_created = daily_stats.locks_created + excluded.locks_created,
        locked_amount = daily_stats.locked_amount + excluded.locked_amount,
        claims = daily_stats.claims + excluded.claims`;
  }
}

const day = (iso: string) => iso.slice(0, 10);
const num = (v: unknown) => Number(typeof v === "string" ? v : 0) || 0;

/** Applies one page of a stream inside a transaction. Exported for tests. */
export async function applyPage(sql: Sql, net: Network, stream: Stream, records: unknown[], threshold = largeThreshold()) {
  const days = new Map<string, DayAgg>();
  const bump = (iso: string) => {
    const k = day(iso);
    let d = days.get(k);
    if (!d) days.set(k, (d = emptyDay()));
    return d;
  };
  const large: Record<string, unknown>[] = [];
  const claimed: { id: string; at: string }[] = [];
  const lockups: Record<string, unknown>[] = [];

  if (stream === "ledgers") {
    for (const l of records as Ledger[]) {
      const d = bump(l.closed_at);
      d.ledgers += 1;
      d.txs += l.successful_transaction_count;
      d.failed_txs += l.failed_transaction_count;
      d.ops += l.operation_count;
    }
  } else if (stream === "operations") {
    for (const op of records as Operation[]) {
      if (op.transaction_successful === false) continue;
      const d = bump(op.created_at);
      if (op.type === "payment" && op.asset_type === "native") {
        const amount = num(op.amount);
        d.payments += 1;
        d.payment_volume += amount;
        if (amount >= threshold) {
          large.push({ net, op_id: op.id, tx_hash: op.transaction_hash, ledger_time: op.created_at, from_acc: op.from as string, to_acc: op.to as string, amount: String(op.amount), kind: "payment" });
        }
      } else if (op.type === "create_account") {
        const amount = num(op.starting_balance);
        d.new_accounts += 1;
        d.payment_volume += amount;
        if (amount >= threshold) {
          large.push({ net, op_id: op.id, tx_hash: op.transaction_hash, ledger_time: op.created_at, from_acc: op.funder as string, to_acc: op.account as string, amount: String(op.starting_balance), kind: "create_account" });
        }
      } else if (op.type === "create_claimable_balance" && op.asset === "native") {
        d.locks_created += 1;
        d.locked_amount += num(op.amount);
      } else if (op.type === "claim_claimable_balance") {
        d.claims += 1;
        claimed.push({ id: String(op.balance_id), at: op.created_at });
      }
    }
  } else {
    for (const c of records as ClaimableBalance[]) {
      if (c.asset !== "native") continue;
      const owner = lockOwner(c.claimants);
      lockups.push({
        net,
        balance_id: c.id,
        claimant: owner?.destination ?? null,
        sponsor: c.sponsor ?? null,
        amount: c.amount,
        unlock_at: owner ? unlockTime(owner.predicate) : null,
        created_at: c.last_modified_time,
      });
    }
  }

  const last = (records[records.length - 1] as { paging_token: string } | undefined)?.paging_token;

  await sql.begin(async (tx) => {
    await addDays(tx, net, days);
    if (large.length) await tx`insert into large_payments ${tx(large)} on conflict do nothing`;
    for (const c of claimed) {
      await tx`update lockups set claimed_at = ${c.at} where net = ${net} and balance_id = ${c.id} and claimed_at is null`;
    }
    if (lockups.length) {
      await tx`
        insert into lockups ${tx(lockups)}
        on conflict (net, balance_id) do update set
          amount = excluded.amount, claimant = excluded.claimant, sponsor = excluded.sponsor, unlock_at = excluded.unlock_at`;
    }
    if (last) {
      await tx`
        insert into sync_state (net, stream, cursor, updated_at) values (${net}, ${stream}, ${last}, now())
        on conflict (net, stream) do update set cursor = excluded.cursor, updated_at = now()`;
    }
  });
  return { applied: records.length, cursor: last };
}

export interface IngestResult {
  net: Network;
  stream: Stream;
  pages: number;
  records: number;
  caughtUp: boolean;
  cursor: string;
}

/** Runs one stream until it is caught up or the deadline passes. */
export async function ingestStream(sql: Sql, net: Network, stream: Stream, deadline: number): Promise<IngestResult> {
  let cursor = await loadCursor(sql, net, stream);
  let pages = 0;
  let total = 0;
  let caughtUp = false;
  while (Date.now() < deadline) {
    const records = await fetchRecords<{ paging_token: string }>(net, PATHS[stream].path, {
      ...PATHS[stream].params,
      order: "asc",
      limit: String(PAGE),
      cursor,
    });
    if (!records.length) {
      caughtUp = true;
      break;
    }
    const r = await applyPage(sql, net, stream, records);
    cursor = r.cursor ?? cursor;
    pages += 1;
    total += records.length;
    if (records.length < PAGE) {
      caughtUp = true;
      break;
    }
  }
  return { net, stream, pages, records: total, caughtUp, cursor };
}

/** All streams for the given networks, live streams first so they never fall behind the lockup backfill. */
export async function ingestAll(sql: Sql, nets: Network[], budgetMs: number) {
  const deadline = Date.now() + budgetMs;
  const results: IngestResult[] = [];
  for (const stream of STREAMS) {
    for (const net of nets) {
      if (Date.now() >= deadline) break;
      // Live streams get the whole budget; the lockup backfill takes whatever is left.
      results.push(await ingestStream(sql, net, stream, deadline));
    }
  }
  return results;
}
