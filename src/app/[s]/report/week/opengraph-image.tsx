import { getWeekReport } from "@/lib/insights";
import { ogCard, ogSize } from "@/lib/og";
import { statsEnabled } from "@/lib/stats";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "Pi weekly report";

const fmt = (v: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export default async function Image() {
  if (!statsEnabled()) return ogCard({ kicker: "Pi weekly report", title: "Blockchain Pi", lines: [], cacheSeconds: 600 });
  const r = await getWeekReport("mainnet");
  const change = r.open && r.close ? ((r.close - r.open) / r.open) * 100 : null;
  return ogCard({
    cacheSeconds: 6 * 3600,
    kicker: `Pi weekly report · ${r.from} → ${r.to}`,
    title: r.close ? `$${r.close.toFixed(4)}${change !== null ? `  ${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : ""}` : "Pi Network",
    lines: [
      `${fmt(r.totals.txs)} transactions · ${fmt(r.totals.newAccounts)} new accounts`,
      r.exchNet !== null ? `Net into exchanges ${r.exchNet > 0 ? "+" : ""}${fmt(r.exchNet)} Pi` : "",
    ].filter(Boolean),
  });
}
