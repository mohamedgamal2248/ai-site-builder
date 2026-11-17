import { getDb } from "./db";
import { horizonHost, type Network } from "./horizon";

export interface Check {
  name: string;
  state: "ok" | "degraded" | "down";
  ms?: number;
  detail?: string;
}

async function timed(fn: () => Promise<unknown>) {
  const t0 = Date.now();
  await fn();
  return Date.now() - t0;
}

/** Live checks of Horizon, the price source, the database and indexer lag. */
export async function healthChecks(net: Network): Promise<Check[]> {
  const out: Check[] = [];
  try {
    const ms = await timed(() => fetch(`${horizonHost(net)}/`, { cache: "no-store", signal: AbortSignal.timeout(8000) }).then((r) => { if (!r.ok) throw new Error(String(r.status)); }));
    out.push({ name: "Pi Horizon API", state: ms > 2500 ? "degraded" : "ok", ms });
  } catch (e) {
    out.push({ name: "Pi Horizon API", state: "down", detail: String((e as Error).message) });
  }
  try {
    const ms = await timed(() => fetch("https://www.okx.com/api/v5/market/ticker?instId=PI-USDT", { cache: "no-store", signal: AbortSignal.timeout(6000) }).then((r) => { if (!r.ok) throw new Error(String(r.status)); }));
    out.push({ name: "OKX price", state: ms > 2500 ? "degraded" : "ok", ms });
  } catch (e) {
    out.push({ name: "OKX price", state: "down", detail: String((e as Error).message) });
  }
  const sql = getDb();
  if (sql) {
    try {
      let rows: { stream: string; cursor: string; age: number }[] = [];
      const ms = await timed(async () => {
        rows = await sql<{ stream: string; cursor: string; age: number }[]>`
          select stream, cursor, extract(epoch from now() - updated_at)::int as age from sync_state where net = ${net}`;
      });
      out.push({ name: "Database", state: ms > 2000 ? "degraded" : "ok", ms });
      for (const s of ["ledgers", "operations"]) {
        const r = rows.find((x) => x.stream === s);
        out.push({
          name: `Indexer: ${s}`,
          state: !r ? "down" : r.age > 900 ? "down" : r.age > 420 ? "degraded" : "ok",
          detail: r ? `${Math.round(r.age / 60)} min` : "not started",
        });
      }
      for (const s of ["claimable", "ledgers_bf", "operations_bf"]) {
        const r = rows.find((x) => x.stream === s);
        const end = rows.find((x) => x.stream === `${s}_end`);
        let detail = r ? "running" : "not started";
        if (r && end && r.cursor && end.cursor) {
          try {
            detail = BigInt(r.cursor) >= BigInt(end.cursor) ? "done" : "running";
          } catch {
            /* claimable cursors are not numbers */
          }
        }
        out.push({ name: `Backfill: ${s}`, state: r ? "ok" : "degraded", detail });
      }
    } catch (e) {
      out.push({ name: "Database", state: "down", detail: String((e as Error).message).slice(0, 80) });
    }
  } else {
    out.push({ name: "Database", state: "degraded", detail: "not configured" });
  }
  return out;
}
