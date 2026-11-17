/**
 * Public market data for PI/USDT: order books from OKX and Bitget, 24h volume, daily candles.
 * All requests go through Next's data cache, so a burst of visitors costs one upstream call.
 */

export interface Level {
  price: number;
  size: number;
}

export interface Book {
  exchange: "OKX" | "Bitget";
  bids: Level[];
  asks: Level[];
  mid: number;
}

export interface Depth {
  exchange: string;
  mid: number;
  /** Pi on each side within ±pct of the mid price. */
  bands: { pct: number; bid: number; ask: number; imbalance: number }[];
  bidWall: Level | null;
  askWall: Level | null;
}

async function json<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const levels = (rows: string[][] | undefined) => (rows ?? []).map((r) => ({ price: Number(r[0]), size: Number(r[1]) })).filter((l) => l.price > 0 && l.size > 0);

export async function getBooks(revalidate = 60): Promise<Book[]> {
  const [okx, bitget] = await Promise.all([
    json<{ data?: { bids: string[][]; asks: string[][] }[] }>("https://www.okx.com/api/v5/market/books?instId=PI-USDT&sz=400", revalidate),
    json<{ data?: { bids: string[][]; asks: string[][] } }>("https://api.bitget.com/api/v2/spot/market/orderbook?symbol=PIUSDT&type=step0&limit=150", revalidate),
  ]);
  const out: Book[] = [];
  const add = (exchange: Book["exchange"], b?: { bids: string[][]; asks: string[][] }) => {
    if (!b) return;
    const bids = levels(b.bids);
    const asks = levels(b.asks);
    if (!bids.length || !asks.length) return;
    out.push({ exchange, bids, asks, mid: (bids[0].price + asks[0].price) / 2 });
  };
  add("OKX", okx?.data?.[0]);
  add("Bitget", bitget?.data);
  return out;
}

export function depthOf(book: Book, pcts = [1, 2, 5]): Depth {
  const bands = pcts.map((pct) => {
    const lo = book.mid * (1 - pct / 100);
    const hi = book.mid * (1 + pct / 100);
    const bid = book.bids.filter((l) => l.price >= lo).reduce((s, l) => s + l.size, 0);
    const ask = book.asks.filter((l) => l.price <= hi).reduce((s, l) => s + l.size, 0);
    return { pct, bid, ask, imbalance: bid + ask ? (bid - ask) / (bid + ask) : 0 };
  });
  const within = (side: Level[], ok: (p: number) => boolean) => side.filter((l) => ok(l.price)).sort((a, b) => b.size - a.size)[0] ?? null;
  return {
    exchange: book.exchange,
    mid: book.mid,
    bands,
    bidWall: within(book.bids, (p) => p >= book.mid * 0.95),
    askWall: within(book.asks, (p) => p <= book.mid * 1.05),
  };
}

/** Combined bid/ask Pi within ±2% across both exchanges. */
export function combinedImbalance(books: Book[]) {
  let bid = 0;
  let ask = 0;
  for (const b of books) {
    const band = depthOf(b, [2]).bands[0];
    bid += band.bid;
    ask += band.ask;
  }
  return { bid, ask, imbalance: bid + ask ? (bid - ask) / (bid + ask) : null };
}

/** OKX 24h volume in Pi (base currency). */
export async function getVolumePi(revalidate = 300): Promise<number | null> {
  const t = await json<{ data?: { vol24h: string }[] }>("https://www.okx.com/api/v5/market/ticker?instId=PI-USDT", revalidate);
  const v = Number(t?.data?.[0]?.vol24h);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Daily closes from OKX (oldest first), up to ~200 days. */
export async function getDailyCloses(days = 120): Promise<{ day: string; close: number }[]> {
  const t = await json<{ data?: string[][] }>(`https://www.okx.com/api/v5/market/history-candles?instId=PI-USDT&bar=1Dutc&limit=${Math.min(days, 100)}`, 3600);
  const rows = (t?.data ?? []).map((c) => ({ day: new Date(Number(c[0])).toISOString().slice(0, 10), close: Number(c[4]) }));
  if (days > 100 && rows.length) {
    const older = await json<{ data?: string[][] }>(
      `https://www.okx.com/api/v5/market/history-candles?instId=PI-USDT&bar=1Dutc&limit=100&after=${Date.parse(rows[rows.length - 1].day)}`,
      3600,
    );
    rows.push(...(older?.data ?? []).map((c) => ({ day: new Date(Number(c[0])).toISOString().slice(0, 10), close: Number(c[4]) })));
  }
  return rows.filter((r) => Number.isFinite(r.close)).reverse();
}
