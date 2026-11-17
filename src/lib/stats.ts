import { unstable_cache } from "next/cache";
import { getDb } from "./db";
import type { Network } from "./horizon";

/**
 * Results are kept in Next's shared data cache, so every server instance reuses the same
 * answer instead of each one querying Postgres. Falls back to a per-instance memo outside
 * a Next request (scripts, tests).
 */
const memo = new Map<string, { at: number; value: unknown }>();
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  try {
    return await unstable_cache(async () => JSON.parse(JSON.stringify(await load())) as T, ["stats", key], {
      revalidate: Math.max(1, Math.round(ttlMs / 1000)),
      tags: ["stats"],
    })();
  } catch (e) {
    if (!(e instanceof Error) || !/incrementalCache|static generation|unstable_cache/i.test(e.message)) throw e;
    const hit = memo.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
    const value = await load();
    memo.set(key, { at: Date.now(), value });
    return value;
  }
}

export function statsEnabled() {
  return getDb() !== null;
}

export interface DailyRow {
  day: string;
  ledgers: number;
  txs: number;
  failed_txs: number;
  ops: number;
  payments: number;
  payment_volume: string;
  new_accounts: number;
  locks_created: number;
  locked_amount: string;
  claims: number;
}

export function getDaily(net: Network, days = 30) {
  return cached(`daily:${net}:${days}`, 60_000, async () => {
    const sql = getDb()!;
    return sql<DailyRow[]>`
      select to_char(day, 'YYYY-MM-DD') as day, ledgers, txs, failed_txs, ops, payments,
             payment_volume::text, new_accounts, locks_created, locked_amount::text, claims
      from daily_stats
      where net = ${net} and day >= (now() at time zone 'utc')::date - ${days - 1}::int
      order by day`;
  });
}

export interface LargeRow {
  op_id: string;
  tx_hash: string;
  ledger_time: string;
  from_acc: string | null;
  to_acc: string | null;
  amount: string;
  kind: string;
}

export function getLargest(net: Network, hours: number, limit = 50) {
  return cached(`largest:${net}:${hours}:${limit}`, 60_000, async () => {
    const sql = getDb()!;
    return sql<LargeRow[]>`
      select op_id, tx_hash, to_char(ledger_time at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ledger_time,
             from_acc, to_acc, amount::text, kind
      from large_payments
      where net = ${net} and ledger_time >= now() - make_interval(hours => ${hours})
      order by amount desc
      limit ${limit}`;
  });
}

export interface UnlockMonth {
  month: string;
  amount: string;
  count: number;
}

export interface UnlockSummary {
  months: UnlockMonth[];
  stillLocked: string;
  stillLockedCount: number;
  unlockedUnclaimed: string;
  unlockedUnclaimedCount: number;
}

/** Native Pi that unlocks each month from now on, from lockups that have not been claimed. */
export function getUnlocks(net: Network, months = 24): Promise<UnlockSummary> {
  return cached(`unlocks:${net}:${months}`, 5 * 60_000, async () => {
    const sql = getDb()!;
    const [monthsRows, totals] = await Promise.all([
      sql<UnlockMonth[]>`
        select to_char(date_trunc('month', unlock_at at time zone 'utc'), 'YYYY-MM') as month,
               sum(amount)::text as amount, count(*)::int as count
        from lockups
        where net = ${net} and unlock_at > now()
          and unlock_at < date_trunc('month', now()) + make_interval(months => ${months})
        group by 1 order by 1`,
      sql<{ locked: string; locked_n: number; free: string; free_n: number }[]>`
        select coalesce(sum(amount) filter (where unlock_at > now()), 0)::text as locked,
               (count(*) filter (where unlock_at > now()))::int as locked_n,
               coalesce(sum(amount) filter (where unlock_at <= now()), 0)::text as free,
               (count(*) filter (where unlock_at <= now()))::int as free_n
        from lockups
        where net = ${net}`,
    ]);
    const t = totals[0];
    return {
      months: monthsRows,
      stillLocked: t.locked,
      stillLockedCount: t.locked_n,
      unlockedUnclaimed: t.free,
      unlockedUnclaimedCount: t.free_n,
    };
  });
}

export interface SyncRow {
  stream: string;
  cursor: string;
  updated_at: string;
}

export function getSync(net: Network) {
  return cached(`sync:${net}`, 30_000, async () => {
    const sql = getDb()!;
    return sql<SyncRow[]>`
      select stream, cursor, to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
      from sync_state where net = ${net}`;
  });
}

/** The lockup backfill walks balances by ledger; its cursor starts with that ledger number. */
export function backfillProgress(cursor: string | undefined, latestLedger: number) {
  const ledger = Number((cursor ?? "").split("-")[0]);
  if (!Number.isFinite(ledger) || ledger <= 0 || !latestLedger) return 0;
  return Math.min(100, (ledger / latestLedger) * 100);
}

export interface LockedHolder {
  claimant: string;
  amount: string;
  count: number;
  next_unlock: string | null;
}

/** Accounts with the most native Pi still locked (from indexed lockups). */
export function getTopLocked(net: Network, limit = 25) {
  return cached(`toplocked:${net}:${limit}`, 5 * 60_000, async () => {
    const sql = getDb()!;
    return sql<LockedHolder[]>`
      select claimant, sum(amount)::text as amount, count(*)::int as count,
             to_char(min(unlock_at) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as next_unlock
      from lockups
      where net = ${net} and unlock_at > now() and claimant is not null
      group by claimant
      order by sum(amount) desc
      limit ${limit}`;
  });
}

/** Rolls daily rows into weeks or months so long ranges stay readable. */
export function bucketDaily(rows: DailyRow[], size: "day" | "week" | "month"): DailyRow[] {
  if (size === "day") return rows;
  const out = new Map<string, DailyRow>();
  for (const r of rows) {
    const d = new Date(`${r.day}T00:00:00Z`);
    let key: string;
    if (size === "month") key = r.day.slice(0, 7);
    else {
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      key = monday.toISOString().slice(0, 10);
    }
    const b = out.get(key);
    if (!b) out.set(key, { ...r, day: key });
    else {
      b.ledgers += r.ledgers; b.txs += r.txs; b.failed_txs += r.failed_txs; b.ops += r.ops; b.payments += r.payments;
      b.payment_volume = (Number(b.payment_volume) + Number(r.payment_volume)).toFixed(7);
      b.new_accounts += r.new_accounts; b.locks_created += r.locks_created;
      b.locked_amount = (Number(b.locked_amount) + Number(r.locked_amount)).toFixed(7);
      b.claims += r.claims;
    }
  }
  return [...out.values()];
}

/* ---------- Known-wallet flows and history ---------- */

export interface FlowRow {
  address: string;
  day: string;
  inflow: string;
  outflow: string;
  n_in: number;
  n_out: number;
}

export function getFlows(net: Network, addresses: string[], days = 30) {
  return cached(`flows:${net}:${days}:${addresses.join(",")}`, 60_000, async () => {
    const sql = getDb()!;
    return sql<FlowRow[]>`
      select address, to_char(day, 'YYYY-MM-DD') as day, inflow::text, outflow::text, n_in, n_out
      from wallet_flows_daily
      where net = ${net} and address = any(${addresses}) and day >= (now() at time zone 'utc')::date - ${days - 1}::int
      order by day`;
  });
}

export interface BalanceRow {
  address: string;
  day: string;
  balance: string;
}

export function getWalletHistory(net: Network, days = 90) {
  return cached(`wbal:${net}:${days}`, 5 * 60_000, async () => {
    const sql = getDb()!;
    return sql<BalanceRow[]>`
      select address, to_char(day, 'YYYY-MM-DD') as day, balance::text
      from wallet_balances
      where net = ${net} and day >= (now() at time zone 'utc')::date - ${days - 1}::int
      order by day`;
  });
}

export interface HolderRow {
  account: string;
  balance: string;
  updated_at: string;
}

export function getHolders(net: Network, limit = 100) {
  return cached(`holders:${net}:${limit}`, 2 * 60_000, async () => {
    const sql = getDb()!;
    const [rows, total] = await Promise.all([
      sql<HolderRow[]>`
        select account, balance::text, to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
        from holders where net = ${net} and balance is not null order by balance desc limit ${limit}`,
      sql<{ n: number }[]>`select count(*)::int as n from holders where net = ${net}`,
    ]);
    return { rows, tracked: total[0]?.n ?? 0 };
  });
}

export interface CalendarDay {
  day: string;
  amount: string;
  count: number;
}

/** Pi unlocking each day for the next `days` days. */
export function getUnlockCalendar(net: Network, days = 30) {
  return cached(`ucal:${net}:${days}`, 5 * 60_000, async () => {
    const sql = getDb()!;
    return sql<CalendarDay[]>`
      select to_char(unlock_at at time zone 'utc', 'YYYY-MM-DD') as day, sum(amount)::text as amount, count(*)::int as count
      from lockups
      where net = ${net} and unlock_at > now() and unlock_at < now() + make_interval(days => ${days})
      group by 1 order by 1`;
  });
}

export interface LargeFilter {
  hours: number;
  min: number;
  limit?: number;
}

/** Latest large transfers (newest first), for the whale feed. */
export function getWhaleFeed(net: Network, f: LargeFilter) {
  return cached(`whales:${net}:${f.hours}:${f.min}:${f.limit ?? 100}`, 20_000, async () => {
    const sql = getDb()!;
    return sql<LargeRow[]>`
      select op_id, tx_hash, to_char(ledger_time at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ledger_time,
             from_acc, to_acc, amount::text, kind
      from large_payments
      where net = ${net} and ledger_time >= now() - make_interval(hours => ${f.hours}) and amount >= ${f.min}
      order by ledger_time desc
      limit ${f.limit ?? 100}`;
  });
}

export function getLockedTotal(net: Network) {
  return cached(`locked:${net}`, 5 * 60_000, async () => {
    const sql = getDb()!;
    const [r] = await sql<{ amount: string; n: number }[]>`
      select coalesce(sum(amount), 0)::text as amount, count(*)::int as n from lockups where net = ${net} and unlock_at > now()`;
    return r;
  });
}
