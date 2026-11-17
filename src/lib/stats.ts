import { getDb } from "./db";
import type { Network } from "./horizon";

/** Small per-instance memo so a burst of visitors does not hit Postgres for the same numbers. */
const memo = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  memo.set(key, { at: Date.now(), value });
  return value;
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
        where net = ${net} and claimed_at is null and unlock_at > now()
          and unlock_at < date_trunc('month', now()) + make_interval(months => ${months})
        group by 1 order by 1`,
      sql<{ locked: string; locked_n: number; free: string; free_n: number }[]>`
        select coalesce(sum(amount) filter (where unlock_at > now()), 0)::text as locked,
               (count(*) filter (where unlock_at > now()))::int as locked_n,
               coalesce(sum(amount) filter (where unlock_at <= now()), 0)::text as free,
               (count(*) filter (where unlock_at <= now()))::int as free_n
        from lockups
        where net = ${net} and claimed_at is null`,
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
