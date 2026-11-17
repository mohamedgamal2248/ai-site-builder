import Link from "next/link";
import type { ReactNode } from "react";
import { LiveFeed } from "@/components/LiveFeed";
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

  const blockHero = (
    <div className="hero-block">
      <div className="k">{t.latestBlock}</div>
      <div className="v sub-v">
        <Link href={`/blocks/${ledger.sequence}`}>
          <bdi dir="ltr">#{ledger.sequence.toLocaleString("en")}</bdi>
        </Link>
      </div>
      <div className="s" suppressHydrationWarning>{timeAgo(ledger.closed_at, Date.now(), lang)}</div>
    </div>
  );
  const supplyHero = (
    <div className="hero-block">
      <div className="k">{t.totalSupply}</div>
      <div className="v sub-v">
        <bdi dir="ltr">{compact(ledger.total_coins, lang)}</bdi>
      </div>
      <div className="s">
        <bdi dir="ltr">{formatAmount(ledger.total_coins, 0)}</bdi> {native}
      </div>
    </div>
  );

  const unit = <span className="unit"> {native}</span>;
  const stats: { label: string; value: ReactNode; hint?: ReactNode }[] = [
    { label: t.feePool, value: <><bdi dir="ltr">{compact(ledger.fee_pool, lang)}</bdi>{unit}</> },
    { label: t.baseFee, value: <><bdi dir="ltr">{stroopsToPi(ledger.base_fee_in_stroops)}</bdi>{unit}</> },
    { label: t.feeMode, value: <><bdi dir="ltr">{fees ? stroopsToPi(fees.fee_charged.mode) : "—"}</bdi>{unit}</> },
    { label: t.baseReserve, value: <><bdi dir="ltr">{stroopsToPi(ledger.base_reserve_in_stroops)}</bdi>{unit}</> },
    {
      label: t.capacity,
      value: <bdi dir="ltr">{fees ? `${Math.round(Number(fees.ledger_capacity_usage) * 100)}%` : "—"}</bdi>,
      hint: `${ledger.operation_count} ${t.ops}`,
    },
    { label: t.protocol, value: <bdi dir="ltr">v{ledger.protocol_version}</bdi>, hint: net === "mainnet" ? t.mainnet : t.testnet },
  ];

  return (
    <>
      <section className="hero" aria-label={t.tagline}>
        {price ? (
          <div className="hero-block">
            <div className="k">{t.price}</div>
            <div className="v">
              <bdi dir="ltr">${price.last.toFixed(4)}</bdi>
            </div>
            <div className="s">
              <span className={`chg ${price.changePct >= 0 ? "up" : "down"}`}>
                <bdi dir="ltr">
                  {price.changePct >= 0 ? "▲" : "▼"} {Math.abs(price.changePct).toFixed(2)}%
                </bdi>
              </span>
              <span>{t.change24h}</span>
              <span aria-hidden="true">·</span>
              <span>{t.priceSource}</span>
            </div>
          </div>
        ) : (
          blockHero
        )}
        <div className="hero-row">
          {price ? blockHero : null}
          {supplyHero}
        </div>
      </section>

      <div className="stats six">
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
      <p className="muted" style={{ fontSize: 12.5 }}>{t.apiNote}</p>
    </>
  );
}
