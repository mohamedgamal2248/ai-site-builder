import { getReport } from "@/lib/insights";
import { ogCard, ogSize } from "@/lib/og";
import { bandOf } from "@/lib/pindex";
import { statsEnabled } from "@/lib/stats";
import { validDay } from "../view";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "Pi daily report";

const fmt = (v: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const BAND: Record<string, string> = { strong_sell: "strong selling pressure", sell: "leaning to selling", neutral: "neutral", buy: "leaning to buying", strong_buy: "strong buying pressure" };

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!validDay(date) || !statsEnabled()) return ogCard({ kicker: "Pi daily report", title: date, lines: [], cacheSeconds: 300 });
  const r = await getReport("mainnet", date);
  const done = date < new Date().toISOString().slice(0, 10);
  const change = r.close && r.prevClose ? ((r.close - r.prevClose) / r.prevClose) * 100 : null;
  const band = bandOf(r.index);
  return ogCard({
    cacheSeconds: done ? 60 * 60 * 24 * 7 : 600,
    kicker: `Pi daily report · ${date}`,
    title: r.close ? `$${r.close.toFixed(4)}${change !== null ? `  ${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : ""}` : "Pi Network",
    lines: [
      r.index !== null && band ? `Pressure index ${r.index.toFixed(0)}/100 · ${BAND[band]}` : "",
      [r.exchNet !== null ? `Net into exchanges ${r.exchNet > 0 ? "+" : ""}${fmt(r.exchNet)} Pi` : "", r.stats ? `${fmt(r.stats.txs)} transactions` : ""].filter(Boolean).join(" · "),
    ].filter(Boolean),
  });
}
