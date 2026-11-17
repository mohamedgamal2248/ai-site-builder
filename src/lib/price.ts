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
