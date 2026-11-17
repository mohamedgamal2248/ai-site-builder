/**
 * Statistics indexer. Reads Pi's Horizon API in ascending pages and keeps
 * small aggregate tables in Postgres up to date. Each page and its cursor are
 * written in one transaction, so a crash never double-counts.
 *
 * Storage is kept small on purpose (the database may share a free-tier quota):
 * only lockups that are still locked, daily aggregates, large transfers and the
 * largest holders are stored — never every operation.
 *
 * Imports are relative so the same code runs from Next routes and from `tsx scripts/ingest.ts`.
 */
import type postgres from "postgres";
import { knownWallet, knownWallets } from "../data/wallets";
import type { Sql } from "./db";
import { lockOwner, unlockTime } from "./format";
import { horizonHost, type ClaimableBalance, type Ledger, type Network, type Operation } from "./horizon";

const PAGE = 200;
export const STREAMS = ["ledgers", "operations", "claimable", "ledgers_bf", "operations_bf"] as const;
export type Stream = (typeof STREAMS)[number];
type Base = "ledgers" | "operations" | "claimable";
const baseOf = (s: Stream): Base => (s.startsWith("ledgers") ? "ledgers" : s.startsWith("operations") ? "operations" : "claimable");

export function largeThreshold() {
  const n = Number(process.env.LARGE_PAYMENT_MIN || 10000);
  return Number.isFinite(n) && n > 0 ? n : 10000;
}
/** Accounts that move at least this much Pi are tracked for the rich list. */
const HOLDER_MIN = Number(process.env.HOLDER_MIN || 1000);
const HOLDERS_KEEP = 5000;
const BACKFILL_DAYS = Number(process.env.BACKFILL_DAYS || 90);
const LEDGERS_PER_DAY = 17280; // ~5 s per ledger

async function fetchJson<T>(net: Network, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, horizonHost(net));
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    const err = new Error(`Horizon ${res.status} for ${url.pathname}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

const fetchRecords = async <T,>(net: Network, path: string, params: Record<string, string>) =>
  (await fetchJson<{ _embedded: { records: T[] } }>(net, path, params))._embedded.records;

const PATHS: Record<Base, { path: string; params: Record<string, string> }> = {
  ledgers: { path: "/ledgers", params: {} },
  operations: { path: "/operations", params: {} },
  claimable: { path: "/claimable_balances", params: { asset: "native" } },
};

async function getState(sql: Sql, net: Network, stream: string) {
  const rows = await sql<{ cursor: string }[]>`select cursor from sync_state where net = ${net} and stream = ${stream}`;
  return rows[0]?.cursor;
}
async function setState(sql: Sql | postgres.TransactionSql, net: Network, stream: string, cursor: string) {
  await sql`
    insert into sync_state (net, stream, cursor, updated_at) values (${net}, ${stream}, ${cursor}, now())
    on conflict (net, stream) do update set cursor = excluded.cursor, updated_at = now()`;
}

/**
 * Where a stream starts the first time. Live streams start at the newest record; lockups at the
 * very beginning; backfills BACKFILL_DAYS ago and stop where the live stream started.
 */
async function loadCursor(sql: Sql, net: Network, stream: Stream): Promise<string> {
  const have = await getState(sql, net, stream);
  if (have !== undefined) return have;
  let cursor = "";
  if (stream === "ledgers" || stream === "operations") {
    const latest = await fetchRecords<{ paging_token: string }>(net, PATHS[stream].path, { order: "desc", limit: "1" });
    cursor = latest[0]?.paging_token ?? "";
  } else if (stream === "ledgers_bf" || stream === "operations_bf") {
    const live = stream === "ledgers_bf" ? "ledgers" : "operations";
    const end = (await getState(sql, net, `${stream}_end`)) ?? (await loadCursor(sql, net, live));
    await setState(sql, net, `${stream}_end`, end);
    const latest = await fetchRecords<Ledger>(net, "/ledgers", { order: "desc", limit: "1" });
    const startSeq = Math.max(1, (latest[0]?.sequence ?? 1) - BACKFILL_DAYS * LEDGERS_PER_DAY);
    cursor = (BigInt(startSeq) << 32n).toString();
  }
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

type FlowAgg = { inflow: number; outflow: number; n_in: number; n_out: number };

const day = (iso: string) => iso.slice(0, 10);
const num = (v: unknown) => Number(typeof v === "string" ? v : 0) || 0;

/** Applies one page of a stream inside a transaction. Exported for tests. */
export async function applyPage(sql: Sql, net: Network, stream: Stream, records: unknown[], threshold = largeThreshold()) {
  const base = baseOf(stream);
  const days = new Map<string, DayAgg>();
  const bump = (iso: string) => {
    const k = day(iso);
    let d = days.get(k);
    if (!d) days.set(k, (d = emptyDay()));
    return d;
  };
  const flows = new Map<string, FlowAgg>();
  const flow = (address: string, iso: string) => {
    const k = `${address}|${day(iso)}`;
    let f = flows.get(k);
    if (!f) flows.set(k, (f = { inflow: 0, outflow: 0, n_in: 0, n_out: 0 }));
    return f;
  };
  const holders = new Set<string>();
  const large: Record<string, unknown>[] = [];
  const claimed: { id: string; at: string }[] = [];
  const lockups: Record<string, unknown>[] = [];
  const now = Date.now();

  const transfer = (from: string | undefined, to: string | undefined, amount: number, at: string) => {
    if (from && knownWallet(from)) {
      const f = flow(from, at);
      f.outflow += amount;
      f.n_out += 1;
    }
    if (to && knownWallet(to)) {
      const f = flow(to, at);
      f.inflow += amount;
      f.n_in += 1;
    }
    if (amount >= HOLDER_MIN) {
      if (from) holders.add(from);
      if (to) holders.add(to);
    }
  };

  if (base === "ledgers") {
    for (const l of records as Ledger[]) {
      const d = bump(l.closed_at);
      d.ledgers += 1;
      d.txs += l.successful_transaction_count;
      d.failed_txs += l.failed_transaction_count;
      d.ops += l.operation_count;
    }
  } else if (base === "operations") {
    for (const op of records as Operation[]) {
      if (op.transaction_successful === false) continue;
      const d = bump(op.created_at);
      if (op.type === "payment" && op.asset_type === "native") {
        const amount = num(op.amount);
        d.payments += 1;
        d.payment_volume += amount;
        transfer(op.from as string, op.to as string, amount, op.created_at);
        if (amount >= threshold) {
          large.push({ net, op_id: op.id, tx_hash: op.transaction_hash, ledger_time: op.created_at, from_acc: op.from as string, to_acc: op.to as string, amount: String(op.amount), kind: "payment" });
        }
      } else if (op.type === "create_account") {
        const amount = num(op.starting_balance);
        d.new_accounts += 1;
        d.payment_volume += amount;
        transfer(op.funder as string, op.account as string, amount, op.created_at);
        if (amount >= threshold) {
          large.push({ net, op_id: op.id, tx_hash: op.transaction_hash, ledger_time: op.created_at, from_acc: op.funder as string, to_acc: op.account as string, amount: String(op.starting_balance), kind: "create_account" });
        }
      } else if (op.type === "create_claimable_balance" && op.asset === "native") {
        d.locks_created += 1;
        d.locked_amount += num(op.amount);
      } else if (op.type === "claim_claimable_balance") {
        d.claims += 1;
        claimed.push({ id: String(op.balance_id), at: op.created_at });
        if (typeof op.claimant === "string") holders.add(op.claimant);
      }
    }
  } else {
    for (const c of records as ClaimableBalance[]) {
      if (c.asset !== "native") continue;
      const owner = lockOwner(c.claimants);
      const unlock = owner ? unlockTime(owner.predicate) : null;
      // Only lockups that are still locked matter for the schedule; skipping the rest keeps the table small.
      if (!unlock || Date.parse(unlock) <= now) continue;
      lockups.push({ net, balance_id: c.id, claimant: owner?.destination ?? null, sponsor: null, amount: c.amount, unlock_at: unlock, created_at: c.last_modified_time });
    }
  }

  const last = (records[records.length - 1] as { paging_token: string } | undefined)?.paging_token;

  await sql.begin(async (tx) => {
    await addDays(tx, net, days);
    for (const [k, f] of flows) {
      const [address, d] = k.split("|");
      await tx`
        insert into wallet_flows_daily ${tx({ net, address, day: d, inflow: f.inflow.toFixed(7), outflow: f.outflow.toFixed(7), n_in: f.n_in, n_out: f.n_out })}
        on conflict (net, address, day) do update set
          inflow = wallet_flows_daily.inflow + excluded.inflow,
          outflow = wallet_flows_daily.outflow + excluded.outflow,
          n_in = wallet_flows_daily.n_in + excluded.n_in,
          n_out = wallet_flows_daily.n_out + excluded.n_out`;
    }
    if (holders.size) {
      const rows = [...holders].filter((a) => /^G[A-Z2-7]{55}$/.test(a)).map((account) => ({ net, account, dirty: true }));
      if (rows.length) await tx`insert into holders ${tx(rows)} on conflict (net, account) do update set dirty = true`;
    }
    if (large.length) await tx`insert into large_payments ${tx(large)} on conflict do nothing`;
    for (const c of claimed) {
      await tx`delete from lockups where net = ${net} and balance_id = ${c.id}`;
    }
    if (lockups.length) {
      await tx`
        insert into lockups ${tx(lockups)}
        on conflict (net, balance_id) do update set
          amount = excluded.amount, claimant = excluded.claimant, unlock_at = excluded.unlock_at`;
    }
    if (last) await setState(tx, net, stream, last);
  });
  return { applied: records.length, cursor: last };
}

export interface IngestResult {
  net: Network;
  stream: string;
  pages: number;
  records: number;
  caughtUp: boolean;
  cursor: string;
}

/** Runs one stream until it is caught up or the deadline passes. Backfills stop at their end cursor. */
export async function ingestStream(sql: Sql, net: Network, stream: Stream, deadline: number): Promise<IngestResult> {
  let cursor = await loadCursor(sql, net, stream);
  const end = stream.endsWith("_bf") ? await getState(sql, net, `${stream}_end`) : undefined;
  const base = baseOf(stream);
  let pages = 0;
  let total = 0;
  let caughtUp = false;
  while (Date.now() < deadline) {
    if (end && BigInt(cursor || "0") >= BigInt(end)) {
      caughtUp = true;
      break;
    }
    let records = await fetchRecords<{ paging_token: string }>(net, PATHS[base].path, {
      ...PATHS[base].params,
      order: "asc",
      limit: String(PAGE),
      cursor,
    });
    const full = records.length === PAGE;
    if (end) records = records.filter((r) => BigInt(r.paging_token) <= BigInt(end));
    if (!records.length) {
      if (end) await setState(sql, net, stream, end);
      caughtUp = true;
      break;
    }
    const r = await applyPage(sql, net, stream, records);
    cursor = r.cursor ?? cursor;
    pages += 1;
    total += records.length;
    if (!full) {
      caughtUp = true;
      break;
    }
  }
  return { net, stream, pages, records: total, caughtUp, cursor };
}

/* ---------- Maintenance steps run after the streams ---------- */

/** Drops lockups whose unlock date has passed, so the table only ever holds future unlocks. */
export async function pruneLockups(sql: Sql) {
  const r = await sql`delete from lockups where unlock_at is null or unlock_at <= now()`;
  return r.count;
}

async function nativeBalance(net: Network, account: string): Promise<string | null> {
  try {
    const a = await fetchJson<{ balances: { asset_type: string; balance: string }[] }>(net, `/accounts/${account}`);
    return a.balances.find((b) => b.asset_type === "native")?.balance ?? "0";
  } catch (e) {
    if ((e as { status?: number }).status === 404) return "0";
    return null;
  }
}

/** One balance per known wallet per UTC day, for the wallet history charts. */
export async function snapshotWallets(sql: Sql, net: Network) {
  if (net !== "mainnet") return 0;
  const today = new Date().toISOString().slice(0, 10);
  const have = await sql<{ address: string }[]>`select address from wallet_balances where net = ${net} and day = ${today}`;
  const done = new Set(have.map((r) => r.address));
  let n = 0;
  for (const w of knownWallets) {
    if (done.has(w.address)) continue;
    const bal = await nativeBalance(net, w.address);
    if (bal === null) continue;
    await sql`insert into wallet_balances (net, address, day, balance) values (${net}, ${w.address}, ${today}, ${bal}) on conflict do nothing`;
    n++;
  }
  return n;
}

/** Refreshes balances of accounts that moved large amounts, and keeps only the biggest HOLDERS_KEEP. */
export async function refreshHolders(sql: Sql, net: Network, max = 150) {
  const due = await sql<{ account: string }[]>`
    select account from holders where net = ${net} and dirty order by updated_at nulls first limit ${max}`;
  let n = 0;
  for (let i = 0; i < due.length; i += 10) {
    const batch = due.slice(i, i + 10);
    const balances = await Promise.all(batch.map((h) => nativeBalance(net, h.account)));
    for (let j = 0; j < batch.length; j++) {
      const bal = balances[j];
      if (bal === null) continue;
      await sql`update holders set balance = ${bal}, dirty = false, updated_at = now() where net = ${net} and account = ${batch[j].account}`;
      n++;
    }
  }
  await sql`
    delete from holders where net = ${net} and not dirty and balance < coalesce(
      (select balance from holders where net = ${net} and not dirty order by balance desc offset ${HOLDERS_KEEP} limit 1), -1)`;
  return n;
}

export type MaintenanceHook = (sql: Sql, net: Network, deadline: number) => Promise<unknown>;

/**
 * Live streams first (they are quick), then the heavy backfills share what is left, then
 * maintenance with a few seconds kept in reserve.
 */
export async function ingestAll(sql: Sql, nets: Network[], budgetMs: number, extra?: MaintenanceHook) {
  const start = Date.now();
  const hardDeadline = start + budgetMs;
  const reserve = Math.min(10_000, budgetMs * 0.2);
  const results: IngestResult[] = [];
  const maintenance: Record<string, unknown> = {};

  for (const net of nets) {
    for (const stream of ["ledgers", "operations"] as const) {
      results.push(await ingestStream(sql, net, stream, hardDeadline - reserve));
    }
  }
  const heavy: [Stream, number][] = [["claimable", 0.4], ["operations_bf", 0.4], ["ledgers_bf", 0.2]];
  let backlog = false;
  for (const net of nets) {
    const left = hardDeadline - reserve - Date.now();
    for (const [stream, share] of heavy) {
      if (left <= 0) {
        backlog = true;
        break;
      }
      const r = await ingestStream(sql, net, stream, Math.min(hardDeadline - reserve, Date.now() + left * share));
      results.push(r);
      if (!r.caughtUp) backlog = true;
    }
  }
  for (const net of nets) {
    maintenance[`${net}:pruned_lockups`] = await pruneLockups(sql);
    maintenance[`${net}:wallet_snapshots`] = await snapshotWallets(sql, net);
    // While history is still being filled the holder queue is long; afterwards a small batch keeps up.
    const holderBatch = Date.now() > hardDeadline - 5000 ? 20 : backlog ? 150 : 50;
    maintenance[`${net}:holders_refreshed`] = await refreshHolders(sql, net, holderBatch);
    if (extra) maintenance[`${net}:extra`] = await extra(sql, net, hardDeadline);
  }
  for (const net of nets) {
    await setState(sql, net, "backlog", backlog ? "1" : "0");
    await setState(sql, net, "last_run", new Date().toISOString());
  }
  return { results, maintenance, backlog };
}

/**
 * The scheduler calls every 2 minutes. While history is being filled every call works; once
 * everything is caught up, runs closer than `minGapSec` apart are skipped, so the effective
 * cadence drops to ~5 minutes and a skipped call costs a single small query.
 */
export async function shouldSkip(sql: Sql, net: Network, minGapSec = 270) {
  const rows = await sql<{ stream: string; cursor: string; age: number }[]>`
    select stream, cursor, extract(epoch from now() - updated_at)::int as age
    from sync_state where net = ${net} and stream in ('backlog', 'last_run')`;
  const backlog = rows.find((r) => r.stream === "backlog");
  const last = rows.find((r) => r.stream === "last_run");
  return !!backlog && backlog.cursor === "0" && !!last && last.age < minGapSec;
}
