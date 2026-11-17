/**
 * Pi Pressure Index: one 0–100 number from six on-chain and market signals.
 * Each signal is compared with its own last 30 days (z-score, clipped to ±3), signed so that
 * positive means buying pressure, weighted, and mapped to 0–100 (50 = normal).
 * Informational only; its track record is measured on the accuracy page.
 */
import type { Sql } from "./db";
import type { Network } from "./horizon";
import { combinedImbalance, getBooks, getVolumePi } from "./market";

export type ComponentKey = "exchange_net" | "foundation_out" | "whales" | "unlocks" | "large_deposits" | "order_book";

export const WEIGHTS: Record<ComponentKey, number> = {
  exchange_net: 0.3,
  foundation_out: 0.15,
  whales: 0.15,
  unlocks: 0.15,
  large_deposits: 0.1,
  order_book: 0.15,
};

export interface Component {
  key: ComponentKey;
  /** Raw value in its own unit (Pi, count, ratio). */
  value: number | null;
  baseline: number | null;
  z: number | null;
  /** Signed so that positive = buying pressure. */
  signal: number | null;
  weight: number;
  available: boolean;
  partial?: boolean;
}

export interface PressureIndex {
  at: string;
  score: number | null;
  band: "strong_sell" | "sell" | "neutral" | "buy" | "strong_buy" | null;
  components: Component[];
}

const clip = (v: number, m = 3) => Math.max(-m, Math.min(m, v));

function zScore(current: number, history: number[]) {
  if (history.length < 7) return null;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const sd = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length);
  const floor = Math.max(Math.abs(mean) * 0.1, 1);
  return { z: clip((current - mean) / Math.max(sd, floor)), mean };
}

export function bandOf(score: number | null): PressureIndex["band"] {
  if (score === null) return null;
  if (score < 30) return "strong_sell";
  if (score < 45) return "sell";
  if (score <= 55) return "neutral";
  if (score <= 70) return "buy";
  return "strong_buy";
}

export function combine(components: Component[]) {
  const live = components.filter((c) => c.available && c.signal !== null);
  const w = live.reduce((s, c) => s + c.weight, 0);
  if (w < 0.3) return null;
  const pressure = live.reduce((s, c) => s + c.weight * (c.signal as number), 0) / w;
  return Math.round(Math.max(0, Math.min(100, 50 + pressure * (50 / 3))) * 10) / 10;
}

interface FlowHour {
  hour: string;
  exch_in: string;
  exch_out: string;
  found_out: string;
  large_in_n: number;
}

/** Sums of the 24-hour windows ending at `end`, `end - 24h`, … (index 0 = latest). */
function windows(rows: FlowHour[], end: number, n: number, pick: (r: FlowHour) => number) {
  const sums = new Array(n).fill(0);
  const seen = new Array(n).fill(false);
  for (const r of rows) {
    const age = end - Date.parse(r.hour);
    if (age < 0) continue;
    const i = Math.floor(age / 86_400_000);
    if (i < n) {
      sums[i] += pick(r);
      seen[i] = true;
    }
  }
  return { sums, seen };
}

export async function computeIndex(sql: Sql, net: Network, opts: { live?: boolean } = {}): Promise<PressureIndex> {
  const end = Date.now();
  const [flows, tops, unlock, sync] = await Promise.all([
    sql<FlowHour[]>`
      select to_char(hour at time zone 'utc', 'YYYY-MM-DD"T"HH24:00:00"Z"') as hour, exch_in::text, exch_out::text, found_out::text, large_in_n
      from flows_hourly where net = ${net} and hour >= now() - interval '31 days'`,
    sql<{ hour: string; top_sum: string }[]>`
      select to_char(hour at time zone 'utc', 'YYYY-MM-DD"T"HH24:00:00"Z"') as hour, top_sum::text
      from signals_hourly where net = ${net} and hour >= now() - interval '31 days' and top_sum is not null order by hour`,
    sql<{ amount: string }[]>`select coalesce(sum(amount), 0)::text as amount from lockups where net = ${net} and unlock_at > now() and unlock_at < now() + interval '7 days'`,
    sql<{ stream: string; cursor: string }[]>`select stream, cursor from sync_state where net = ${net} and stream in ('claimable', 'backlog')`,
  ]);
  const [books, volumePi] = opts.live === false ? [[], null] : await Promise.all([getBooks(60), getVolumePi(300)]);

  const comp = (key: ComponentKey, value: number | null, z: { z: number; mean: number } | null, sign: 1 | -1, extra: Partial<Component> = {}): Component => ({
    key,
    value,
    baseline: z?.mean ?? null,
    z: z?.z ?? null,
    signal: z ? sign * z.z : null,
    weight: WEIGHTS[key],
    available: !!z,
    ...extra,
  });

  // 1, 2, 5: exchange net inflow, foundation outflow, large deposits — today's 24h vs the previous 29 days.
  const net_ = windows(flows, end, 30, (r) => Number(r.exch_in) - Number(r.exch_out));
  const found = windows(flows, end, 30, (r) => Number(r.found_out));
  const large = windows(flows, end, 30, (r) => r.large_in_n);
  // Days the indexer covered (exchange wallets move every hour, so a day with no rows was not indexed).
  const covered = net_.seen;
  const hist = (w: { sums: number[] }) => w.sums.slice(1).filter((_, i) => covered[i + 1]);
  const today = covered[0];
  const c1 = comp("exchange_net", net_.sums[0], today ? zScore(net_.sums[0], hist(net_)) : null, -1);
  const c2 = comp("foundation_out", found.sums[0], today ? zScore(found.sums[0], hist(found)) : null, -1);
  const c5 = comp("large_deposits", large.sums[0], today ? zScore(large.sums[0], hist(large)) : null, -1);

  // 3: top-holder total, change over 24h vs daily changes before.
  let c3: Component = comp("whales", null, null, 1);
  if (tops.length >= 2) {
    const at = (t: number) => {
      let best: { hour: string; top_sum: string } | null = null;
      for (const r of tops) if (Date.parse(r.hour) <= t) best = r;
      return best ? Number(best.top_sum) : null;
    };
    const changes: number[] = [];
    for (let d = 1; d < 30; d++) {
      const a = at(end - d * 86_400_000);
      const b = at(end - (d + 1) * 86_400_000);
      if (a !== null && b !== null) changes.push(a - b);
    }
    const now = at(end);
    const before = at(end - 86_400_000);
    if (now !== null && before !== null) {
      const change = now - before;
      // Until there are enough days, fall back to the % change (1% of the total = 1 z).
      const z = zScore(change, changes) ?? (before ? { z: clip(((change / before) * 100) / 1), mean: 0 } : null);
      c3 = comp("whales", change, z, 1);
    }
  }

  // 4: Pi unlocking in the next 7 days, in days of trading volume (only adds selling pressure).
  const unlock7 = Number(unlock[0]?.amount ?? 0);
  const backlog = sync.find((r) => r.stream === "backlog")?.cursor !== "0";
  let c4: Component = comp("unlocks", unlock7, null, -1, { partial: backlog });
  if (volumePi) {
    const days = unlock7 / volumePi;
    const zu = Math.min(3, Math.max(0, days * 2));
    c4 = { ...c4, value: unlock7, baseline: volumePi, z: zu, signal: -zu, available: true };
  }

  // 6: order book within ±2% on OKX and Bitget combined.
  const ob = combinedImbalance(books);
  const c6: Component =
    ob.imbalance === null
      ? comp("order_book", null, null, 1)
      : { key: "order_book", value: ob.imbalance, baseline: null, z: clip(ob.imbalance * 3), signal: clip(ob.imbalance * 3), weight: WEIGHTS.order_book, available: true };

  const components = [c1, c2, c3, c4, c5, c6];
  const score = combine(components);
  return { at: new Date(end).toISOString(), score, band: bandOf(score), components };
}

/* ---------- Track record ---------- */

export interface BacktestRow {
  day: string;
  z: number;
  call: "sell" | "buy" | "none";
  nextReturn: number | null;
  hit: boolean | null;
}

/**
 * Flow-only backtest over the indexed history: each day's exchange net inflow vs the 30 days
 * before it, compared with the next day's price change. A call is made when |z| >= 1.
 */
export function backtestFlows(daily: { day: string; net: number }[], closes: { day: string; close: number }[]): BacktestRow[] {
  const price = new Map(closes.map((c) => [c.day, c.close]));
  const out: BacktestRow[] = [];
  for (let i = 7; i < daily.length; i++) {
    const hist = daily.slice(Math.max(0, i - 30), i).map((d) => d.net);
    const s = zScore(daily[i].net, hist);
    if (!s) continue;
    const d = daily[i].day;
    const next = new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);
    const p0 = price.get(d);
    const p1 = price.get(next);
    const ret = p0 && p1 ? (p1 - p0) / p0 : null;
    const call = s.z >= 1 ? "sell" : s.z <= -1 ? "buy" : "none";
    out.push({ day: d, z: Math.round(s.z * 100) / 100, call, nextReturn: ret, hit: call === "none" || ret === null ? null : call === "sell" ? ret < 0 : ret > 0 });
  }
  return out;
}

export function summarize(rows: { call: string; hit: boolean | null; nextReturn: number | null }[]) {
  const calls = rows.filter((r) => r.hit !== null);
  const hits = calls.filter((r) => r.hit).length;
  const avg = (k: string) => {
    const r = rows.filter((x) => x.call === k && x.nextReturn !== null).map((x) => x.nextReturn as number);
    return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
  };
  return { calls: calls.length, hits, hitRate: calls.length ? hits / calls.length : null, avgAfterSell: avg("sell"), avgAfterBuy: avg("buy"), days: rows.length };
}
