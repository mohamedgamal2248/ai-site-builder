import { getDb } from "./db";
import type { Network } from "./horizon";
import { getDailyCloses, getVolumePi } from "./market";
import { backtestFlows, computeIndex, summarize, type PressureIndex } from "./pindex";
import { cached } from "./stats";

const db = () => getDb()!;

export function getIndex(net: Network): Promise<PressureIndex> {
  return cached(`pindex:${net}`, 5 * 60_000, () => computeIndex(db(), net));
}

export interface IndexPoint {
  hour: string;
  score: number | null;
  price: number | null;
}

export function getIndexHistory(net: Network, hours = 168) {
  return cached(`pindex-hist:${net}:${hours}`, 10 * 60_000, async () => {
    const rows = await db()<{ hour: string; score: string | null; price: string | null }[]>`
      select to_char(hour at time zone 'utc', 'YYYY-MM-DD"T"HH24:00:00"Z"') as hour, score::text, price::text
      from signals_hourly where net = ${net} and hour >= now() - make_interval(hours => ${hours}) order by hour`;
    return rows.map((r) => ({ hour: r.hour, score: r.score === null ? null : Number(r.score), price: r.price === null ? null : Number(r.price) }));
  });
}

/** Flow-only backtest on the indexed history, plus the live index's own record once it exists. */
export function getAccuracy(net: Network) {
  return cached(`accuracy:${net}`, 60 * 60_000, async () => {
    const [daily, closes, live] = await Promise.all([
      db()<{ day: string; net: string }[]>`
        select to_char(date_trunc('day', hour at time zone 'utc'), 'YYYY-MM-DD') as day, sum(exch_in - exch_out)::text as net
        from flows_hourly where net = ${net} and hour < date_trunc('day', now() at time zone 'utc') at time zone 'utc'
        group by 1 order by 1`,
      getDailyCloses(150),
      getIndexHistory(net, 24 * 60),
    ]);
    const rows = backtestFlows(daily.map((d) => ({ day: d.day, net: Number(d.net) })), closes);
    // Live index: score at hour h vs price 24 hours later.
    const byHour = new Map(live.map((p) => [p.hour, p]));
    const liveRows = live
      .filter((p) => p.score !== null && p.price !== null)
      .map((p) => {
        const later = byHour.get(new Date(Date.parse(p.hour) + 86_400_000).toISOString().replace(".000Z", "Z"));
        const ret = later?.price && p.price ? (later.price - p.price) / p.price : null;
        const call = (p.score as number) < 45 ? "sell" : (p.score as number) > 55 ? "buy" : "none";
        return { call, nextReturn: ret, hit: call === "none" || ret === null ? null : call === "sell" ? ret < 0 : ret > 0 };
      });
    return { flows: { rows: rows.slice(-60).reverse(), summary: summarize(rows) }, live: summarize(liveRows) };
  });
}

export interface AlertRow {
  id: string;
  kind: string;
  at: string;
  amount: string | null;
  from_acc: string | null;
  to_acc: string | null;
  tx_hash: string | null;
  meta: Record<string, unknown>;
}

export function getAlerts(net: Network, kinds: string[], limit = 50) {
  return cached(`alerts:${net}:${kinds.join(",")}:${limit}`, 60_000, () =>
    db()<AlertRow[]>`
      select id, kind, to_char(at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at, amount::text, from_acc, to_acc, tx_hash, meta
      from alerts where net = ${net} and kind = any(${kinds}) order by at desc limit ${limit}`,
  );
}

export function getTopTotals(net: Network, hours = 24 * 30) {
  return cached(`toptotals:${net}:${hours}`, 10 * 60_000, async () => {
    const rows = await db()<{ hour: string; top_sum: string }[]>`
      select to_char(hour at time zone 'utc', 'YYYY-MM-DD"T"HH24:00:00"Z"') as hour, top_sum::text
      from signals_hourly where net = ${net} and top_sum is not null and hour >= now() - make_interval(hours => ${hours}) order by hour`;
    return rows.map((r) => ({ t: Date.parse(r.hour), v: Number(r.top_sum) }));
  });
}

export function getUnlockPressure(net: Network) {
  return cached(`upress:${net}`, 10 * 60_000, async () => {
    const [r] = await db()<{ d7: string; d30: string; big: string | null; big_day: string | null }[]>`
      with d as (select day, amount from lockup_days where net = ${net} and day > (now() at time zone 'utc')::date and day <= (now() at time zone 'utc')::date + 30)
      select
        (select coalesce(sum(amount), 0) from d where day <= (now() at time zone 'utc')::date + 7)::text as d7,
        (select coalesce(sum(amount), 0) from d)::text as d30,
        (select amount::text from d order by amount desc limit 1) as big,
        (select to_char(day, 'YYYY-MM-DD') from d order by amount desc limit 1) as big_day`;
    const volume = await getVolumePi(300);
    return { d7: Number(r.d7), d30: Number(r.d30), biggest: r.big ? { day: r.big_day as string, amount: Number(r.big) } : null, volumePi: volume };
  });
}

/* ---------- News (RSS, no AI) ---------- */

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  at: string | null;
}

const FEEDS: { url: string; source?: string }[] = [
  { url: "https://minepi.com/blog/feed/", source: "Pi Network (official)" },
  { url: "https://news.google.com/rss/search?q=%22Pi+Network%22+OR+%22Pi+coin%22&hl=en-US&gl=US&ceid=US:en" },
  { url: "https://news.google.com/rss/search?q=%22Pi+Network%22&hl=ar&gl=EG&ceid=EG:ar" },
];

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();

function parseRss(xml: string, fallbackSource?: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/g)) {
    const block = m[0];
    const tag = (t: string) => block.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1];
    const title = tag("title");
    const link = tag("link");
    if (!title || !link) continue;
    const pub = tag("pubDate");
    const at = pub && !Number.isNaN(Date.parse(pub)) ? new Date(pub).toISOString() : null;
    let t = decode(title);
    let source = fallbackSource ?? decode(tag("source") ?? "");
    // Google News titles end with " - Source".
    if (!fallbackSource && !source) {
      const i = t.lastIndexOf(" - ");
      if (i > 0) {
        source = t.slice(i + 3);
        t = t.slice(0, i);
      }
    } else if (!fallbackSource && t.endsWith(` - ${source}`)) t = t.slice(0, -(source.length + 3));
    const url = decode(link);
    if (!/^https?:\/\//.test(url)) continue;
    items.push({ title: t, link: url, source: source || "News", at });
  }
  return items;
}

export async function getNews(limit = 40): Promise<NewsItem[]> {
  const lists = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000), headers: { "User-Agent": "BlockchainPi/1.0 (+news reader)" } });
        return res.ok ? parseRss(await res.text(), f.source) : [];
      } catch {
        return [];
      }
    }),
  );
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((n) => {
      const k = n.title.toLowerCase().slice(0, 80);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, limit);
}

export { parseRss };

/* ---------- Daily report ---------- */

export interface DayReport {
  day: string;
  stats: { txs: number; payments: number; payment_volume: number; new_accounts: number; locked_amount: number; claims: number } | null;
  exchNet: number | null;
  foundOut: number | null;
  index: number | null;
  close: number | null;
  prevClose: number | null;
  foundation: AlertRow[];
  largest: { op_id: string; tx_hash: string; from_acc: string | null; to_acc: string | null; amount: string; ledger_time: string }[];
}

export function getReport(net: Network, day: string): Promise<DayReport> {
  const today = new Date().toISOString().slice(0, 10);
  // A finished day never changes: keep it for a day; today refreshes every 10 minutes.
  return cached(`report:${net}:${day}`, day < today ? 24 * 3600_000 : 10 * 60_000, async () => {
    const sql = db();
    const [stats, flows, sig, foundation, largest, closes] = await Promise.all([
      sql<{ txs: number; payments: number; payment_volume: string; new_accounts: number; locked_amount: string; claims: number }[]>`
        select txs, payments, payment_volume::text, new_accounts, locked_amount::text, claims from daily_stats where net = ${net} and day = ${day}::date`,
      sql<{ n: number; net_in: string | null; found: string | null }[]>`
        select count(*)::int as n, sum(exch_in - exch_out)::text as net_in, sum(found_out)::text as found
        from flows_hourly where net = ${net} and hour >= ${day}::date and hour < ${day}::date + 1`,
      sql<{ score: string | null }[]>`
        select score::text from signals_hourly where net = ${net} and hour >= ${day}::date and hour < ${day}::date + 1 and score is not null order by hour desc limit 1`,
      sql<AlertRow[]>`
        select id, kind, to_char(at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at, amount::text, from_acc, to_acc, tx_hash, meta
        from alerts where net = ${net} and kind = 'foundation' and at >= ${day}::date and at < ${day}::date + 1 order by amount desc limit 10`,
      sql<DayReport["largest"]>`
        select op_id, tx_hash, from_acc, to_acc, amount::text, to_char(ledger_time at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ledger_time
        from large_payments where net = ${net} and ledger_time >= ${day}::date and ledger_time < ${day}::date + 1 order by amount desc limit 10`,
      net === "mainnet" ? getDailyCloses(120) : Promise.resolve([]),
    ]);
    const s = stats[0];
    const i = closes.findIndex((c) => c.day === day);
    return {
      day,
      stats: s ? { txs: s.txs, payments: s.payments, payment_volume: Number(s.payment_volume), new_accounts: s.new_accounts, locked_amount: Number(s.locked_amount), claims: s.claims } : null,
      exchNet: flows[0]?.n ? Number(flows[0].net_in) : null,
      foundOut: flows[0]?.n ? Number(flows[0].found) : null,
      index: sig[0]?.score ? Number(sig[0].score) : null,
      close: i >= 0 ? closes[i].close : null,
      prevClose: i > 0 ? closes[i - 1].close : null,
      foundation,
      largest,
    };
  });
}

/* ---------- Weekly report ---------- */

export interface WeekReport {
  from: string;
  to: string;
  totals: { txs: number; failed: number; payments: number; volume: number; newAccounts: number; locked: number };
  prevTotals: { txs: number; newAccounts: number; volume: number } | null;
  exchNet: number | null;
  foundOut: number | null;
  indexAvg: number | null;
  open: number | null;
  close: number | null;
  foundation: AlertRow[];
  largest: DayReport["largest"];
}

/** The last 7 complete UTC days (ending yesterday), compared with the 7 days before. */
export function getWeekReport(net: Network): Promise<WeekReport> {
  const to = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const from = new Date(Date.parse(to) - 6 * 86_400_000).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(from) - 7 * 86_400_000).toISOString().slice(0, 10);
  return cached(`week:${net}:${to}`, 6 * 3600_000, async () => {
    const sql = db();
    const [cur, prev, flows, sig, foundation, largest, closes] = await Promise.all([
      sql<{ txs: number; failed: number; payments: number; volume: string; accts: number; locked: string }[]>`
        select coalesce(sum(txs), 0)::int as txs, coalesce(sum(failed_txs), 0)::int as failed, coalesce(sum(payments), 0)::int as payments,
               coalesce(sum(payment_volume), 0)::text as volume, coalesce(sum(new_accounts), 0)::int as accts, coalesce(sum(locked_amount), 0)::text as locked
        from daily_stats where net = ${net} and day between ${from}::date and ${to}::date`,
      sql<{ txs: number; accts: number; volume: string; n: number }[]>`
        select coalesce(sum(txs), 0)::int as txs, coalesce(sum(new_accounts), 0)::int as accts, coalesce(sum(payment_volume), 0)::text as volume, count(*)::int as n
        from daily_stats where net = ${net} and day >= ${prevFrom}::date and day < ${from}::date`,
      sql<{ n: number; net_in: string | null; found: string | null }[]>`
        select count(*)::int as n, sum(exch_in - exch_out)::text as net_in, sum(found_out)::text as found
        from flows_hourly where net = ${net} and hour >= ${from}::date and hour < ${to}::date + 1`,
      sql<{ avg: string | null }[]>`
        select avg(score)::text as avg from signals_hourly where net = ${net} and hour >= ${from}::date and hour < ${to}::date + 1`,
      sql<AlertRow[]>`
        select id, kind, to_char(at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at, amount::text, from_acc, to_acc, tx_hash, meta
        from alerts where net = ${net} and kind = 'foundation' and at >= ${from}::date and at < ${to}::date + 1 order by amount desc limit 10`,
      sql<DayReport["largest"]>`
        select op_id, tx_hash, from_acc, to_acc, amount::text, to_char(ledger_time at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ledger_time
        from large_payments where net = ${net} and ledger_time >= ${from}::date and ledger_time < ${to}::date + 1 order by amount desc limit 10`,
      net === "mainnet" ? getDailyCloses(30) : Promise.resolve([]),
    ]);
    const c = cur[0];
    const p = prev[0];
    const before = closes.filter((x) => x.day < from).at(-1);
    const end = closes.filter((x) => x.day <= to).at(-1);
    return {
      from,
      to,
      totals: { txs: c.txs, failed: c.failed, payments: c.payments, volume: Number(c.volume), newAccounts: c.accts, locked: Number(c.locked) },
      prevTotals: p && p.n >= 7 ? { txs: p.txs, newAccounts: p.accts, volume: Number(p.volume) } : null,
      exchNet: flows[0]?.n ? Number(flows[0].net_in) : null,
      foundOut: flows[0]?.n ? Number(flows[0].found) : null,
      indexAvg: sig[0]?.avg ? Number(sig[0].avg) : null,
      open: before?.close ?? null,
      close: end?.close ?? null,
      foundation,
      largest,
    };
  });
}

/* ---------- Network growth ---------- */

export function getGrowth(net: Network) {
  return cached(`growth:${net}`, 30 * 60_000, async () => {
    const rows = await db()<{ day: string; txs: number; failed: number; accts: number; payments: number }[]>`
      select to_char(day, 'YYYY-MM-DD') as day, txs, failed_txs as failed, new_accounts as accts, payments
      from daily_stats where net = ${net} and day >= (now() at time zone 'utc')::date - 90 and day < (now() at time zone 'utc')::date
      order by day`;
    return rows.map((r) => ({ ...r }));
  });
}
