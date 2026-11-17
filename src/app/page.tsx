import { LiveFeed } from "@/components/LiveFeed";
import { LedgerLink } from "@/components/ui";
import { compact, formatAmount, stroopsToPi, timeAgo } from "@/lib/format";
import { horizon } from "@/lib/horizon";
import { getLatest } from "@/lib/latest";
import { getPiPrice } from "@/lib/price";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await getSettings();
  const { t, net, lang, native } = s;
  const [latest, ledger, fees, price] = await Promise.all([
    getLatest(net),
    horizon.ledgers(net, { limit: 1 }).then((p) => p.records[0]),
    horizon.feeStats(net).catch(() => null),
    net === "mainnet" ? getPiPrice() : Promise.resolve(null),
  ]);

  const stats: { label: string; value: React.ReactNode; hint?: React.ReactNode }[] = [
    { label: t.latestBlock, value: <LedgerLink seq={ledger.sequence} />, hint: <span suppressHydrationWarning>{timeAgo(ledger.closed_at, Date.now(), lang)}</span> },
    { label: t.totalSupply, value: <bdi dir="ltr">{compact(ledger.total_coins, lang)}</bdi>, hint: <bdi dir="ltr">{formatAmount(ledger.total_coins, 0)} {native}</bdi> },
    { label: t.feePool, value: <bdi dir="ltr">{compact(ledger.fee_pool, lang)}</bdi>, hint: native },
    {
      label: t.baseFee,
      value: <bdi dir="ltr">{stroopsToPi(ledger.base_fee_in_stroops)}</bdi>,
      hint: `${native} · ${t.baseReserve} ${stroopsToPi(ledger.base_reserve_in_stroops)}`,
    },
  ];
  if (price) {
    stats.unshift({
      label: t.price,
      value: <bdi dir="ltr">${price.last.toFixed(4)}</bdi>,
      hint: (
        <span>
          <span className={price.changePct >= 0 ? "up" : "down"}>
            <bdi dir="ltr">{price.changePct >= 0 ? "+" : ""}{price.changePct.toFixed(2)}%</bdi>
          </span>{" "}
          {t.change24h} · {t.priceSource}
        </span>
      ),
    });
  }
  if (fees) {
    stats.push({
      label: t.feeMode,
      value: <bdi dir="ltr">{stroopsToPi(fees.fee_charged.mode)}</bdi>,
      hint: `${native} · ${t.capacity} ${Math.round(Number(fees.ledger_capacity_usage) * 100)}%`,
    });
  }
  stats.push({ label: t.protocol, value: <bdi dir="ltr">v{ledger.protocol_version}</bdi>, hint: net === "mainnet" ? t.mainnet : t.testnet });

  return (
    <>
      <div className="stats">
        {stats.map((st) => (
          <div className="stat" key={st.label}>
            <div className="label">{st.label}</div>
            <div className="value">{st.value}</div>
            {st.hint ? <div className="hint">{st.hint}</div> : null}
          </div>
        ))}
      </div>
      <LiveFeed
        initial={latest}
        lang={lang}
        native={native}
        labels={{
          latestBlocks: t.latestBlocks,
          latestTxs: t.latestTxs,
          viewAll: t.viewAll,
          live: t.live,
          paused: t.paused,
          txs: t.txs,
          ops: t.ops,
          failed: t.failed,
          block: t.block,
          fee: t.fee,
        }}
      />
      <p className="muted" style={{ fontSize: 13 }}>{t.apiNote}</p>
    </>
  );
}
