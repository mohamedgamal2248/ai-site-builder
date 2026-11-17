export interface Price {
  last: number;
  open24h: number;
  changePct: number;
  volumeUsdt24h: number;
}

/** PI/USDT spot price from OKX's public market API, cached for 30 seconds. Null if unavailable. */
export async function getPiPrice(): Promise<Price | null> {
  try {
    const res = await fetch("https://www.okx.com/api/v5/market/ticker?instId=PI-USDT", {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { last: string; open24h: string; volCcy24h: string }[] };
    const d = body.data?.[0];
    if (!d) return null;
    const last = Number(d.last);
    const open24h = Number(d.open24h);
    if (!Number.isFinite(last) || !Number.isFinite(open24h) || open24h === 0) return null;
    return { last, open24h, changePct: ((last - open24h) / open24h) * 100, volumeUsdt24h: Number(d.volCcy24h) };
  } catch {
    return null;
  }
}

export interface Market {
  marketCap: number;
  rank: number | null;
  circulating: number;
  totalVolume: number;
  ath: number;
}

/** Market cap, circulating supply and volume across exchanges from CoinGecko, cached for 5 minutes. */
export async function getMarket(): Promise<Market | null> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=pi-network", {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const [d] = (await res.json()) as {
      market_cap: number;
      market_cap_rank: number | null;
      circulating_supply: number;
      total_volume: number;
      ath: number;
    }[];
    if (!d || !Number.isFinite(d.market_cap)) return null;
    return { marketCap: d.market_cap, rank: d.market_cap_rank, circulating: d.circulating_supply, totalVolume: d.total_volume, ath: d.ath };
  } catch {
    return null;
  }
}

export type PriceRange = "24h" | "7d" | "30d";
const BARS: Record<PriceRange, [string, number]> = { "24h": ["15m", 96], "7d": ["1H", 168], "30d": ["4H", 180] };

/** Closing prices for PI/USDT from OKX candles, oldest first. Cached for 2 minutes. */
export async function getCandles(range: PriceRange): Promise<{ t: number; v: number }[]> {
  const [bar, limit] = BARS[range];
  try {
    const res = await fetch(`https://www.okx.com/api/v5/market/candles?instId=PI-USDT&bar=${bar}&limit=${limit}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: string[][] };
    return (body.data ?? [])
      .map((c) => ({ t: Number(c[0]), v: Number(c[4]) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
      .reverse();
  } catch {
    return [];
  }
}
