import { Ago } from "@/components/Ago";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LiveFeed } from "@/components/LiveFeed";
import { LoadMeter, Sparkline } from "@/components/Sparkline";
import { compact, formatAmount, stroopsToPi, timeAgo } from "@/lib/format";
import { horizon, horizonHost } from "@/lib/horizon";
import { getLatest } from "@/lib/latest";
import { getCandles, getMarket, getPiPrice } from "@/lib/price";
import { PriceCard } from "@/components/PriceCard";
import { PriceTicker } from "@/components/PriceTicker";
import { StatsMore } from "@/components/StatsMore";
import { getSettings, type Settings } from "@/lib/settings";
import { getDaily, statsEnabled } from "@/lib/stats";
import { Gauge } from "@/components/Gauge";
import { insightDicts } from "@/lib/i18n-insights";
import { getAlerts, getIndex } from "@/lib/insights";

export const revalidate = 60;

/*
 * The page streams: each section renders as soon as its own data arrives,
 * so a slow price or database call never holds up the rest.
 */
export default async function Home({ params }: { params: Promise<{ s: string }> }) {
  const s = await getSettings(params);
  return (
    <>
      <Suspense fallback={<div className="hero skeleton-hero" aria-hidden="true" />}>
        <Hero s={s} />
      </Suspense>
      <Suspense fallback={<div className="stats eight" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="stat skeleton-stat" />)}</div>}>
        <NetworkStats s={s} />
      </Suspense>
      <Suspense fallback={null}>
        <Today s={s} />
      </Suspense>
      {s.net === "mainnet" && statsEnabled() ? (
        <Suspense fallback={null}>
          <Insights s={s} />
        </Suspense>
      ) : null}
      {s.net === "mainnet" ? (
        <Suspense fallback={<div className="card skeleton-card" style={{ minHeight: 280 }} aria-hidden="true" />}>
          <Price s={s} />
        </Suspense>
      ) : null}
      <Suspense fallback={<div className="grid-feed" aria-hidden="true"><div className="card skeleton-card" /><div className="card skeleton-card" /></div>}>
        <Feed s={s} />
      </Suspense>
      <p className="muted" style={{ fontSize: 12.5 }}>{s.t.apiNote}</p>
    </>
  );
}

async function Hero({ s }: { s: Settings }) {
  const { t, net, lang, native } = s;
  const main = net === "mainnet";
  const [ledger, price, market] = await Promise.all([
    horizon.ledgers(net, { limit: 1 }).then((p) => p.records[0]),
    main ? getPiPrice() : Promise.resolve(null),
    main ? getMarket() : Promise.resolve(null),
  ]);
  const usd = (n: number) => `$${compact(n, lang)}`;
  return (
      <section className="hero" aria-label={t.tagline}>
        {price ? (
          <div className="hero-block">
            <div className="k">{t.price}</div>
            <PriceTicker last={price.last} changePct={price.changePct} label={`${t.change24h} · ${t.priceSource}`} />
          </div>
        ) : (
          <div className="hero-block">
            <div className="k">{t.latestBlock}</div>
            <div className="v">
              <bdi dir="ltr">#{ledger.sequence.toLocaleString("en")}</bdi>
            </div>
            <div className="s">{main ? t.mainnet : t.testnet}</div>
          </div>
        )}
        <div className="hero-row">
          {market ? (
            <>
              <div className="hero-block">
                <div className="k">{t.marketCap}</div>
                <div className="v sub-v"><bdi dir="ltr">{usd(market.marketCap)}</bdi></div>
                <div className="s">{market.rank ? <>{t.rank} <bdi dir="ltr">#{market.rank}</bdi> · </> : null}{t.marketSource}</div>
              </div>
              <div className="hero-block">
                <div className="k">{t.circulating}</div>
                <div className="v sub-v"><bdi dir="ltr">{compact(market.circulating, lang)}</bdi> <small>{native}</small></div>
                <div className="s">{t.volume24h}: <bdi dir="ltr">{usd(market.totalVolume)}</bdi></div>
              </div>
            </>
          ) : (
            <div className="hero-block">
              <div className="k">{t.totalSupply}</div>
              <div className="v sub-v"><bdi dir="ltr">{compact(ledger.total_coins, lang)}</bdi> <small>{native}</small></div>
            </div>
          )}
        </div>
        {main && statsEnabled() ? (
          <Suspense fallback={<div className="hero-block hero-index" aria-hidden="true" />}>
            <HeroIndex s={s} />
          </Suspense>
        ) : null}
      </section>
  );
}

async function HeroIndex({ s }: { s: Settings }) {
  const x = insightDicts[s.lang];
  const idx = await getIndex(s.net).catch(() => null);
  if (!idx) return null;
  return (
    <Link href="/pressure" className="hero-block hero-index">
      <Gauge score={idx.score} label={x.indexTitle} size={96} />
      <div>
        <div className="k">{x.indexShort}</div>
        <div className="v sub-v"><bdi dir="ltr">{idx.score === null ? "—" : idx.score.toFixed(0)}</bdi><small>/100</small></div>
        <div className="s">{idx.band ? x.bands[idx.band] : x.collectingShort}</div>
      </div>
    </Link>
  );
}

async function NetworkStats({ s }: { s: Settings }) {
  const { t, net, lang, native } = s;
  const main = net === "mainnet";
  const [latest, ledger, fees] = await Promise.all([
    getLatest(net, native),
    horizon.ledgers(net, { limit: 1 }).then((p) => p.records[0]),
    horizon.feeStats(net).catch(() => null),
  ]);
  const txs = latest.spark.map((p) => p.txs);
  const secs = latest.spark.map((p) => p.secs);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const load = fees ? Math.round(Number(fees.ledger_capacity_usage) * 100) : null;
  const unit = <span className="unit"> {native}</span>;

  const stats: { label: string; value: ReactNode; hint?: ReactNode; extra?: ReactNode }[] = [
    {
      label: t.latestBlock,
      value: (
        <Link href={`/blocks/${ledger.sequence}`}>
          <bdi dir="ltr">#{ledger.sequence.toLocaleString("en")}</bdi>
        </Link>
      ),
      hint: <Ago iso={ledger.closed_at} lang={lang} />,
    },
    {
      label: t.txPerBlock,
      value: <bdi dir="ltr">{avg(txs).toFixed(1)}</bdi>,
      hint: `${t.peak} ${Math.max(0, ...txs)} · ${t.last50}`,
      extra: <Sparkline values={txs} label={`${t.txPerBlock}, ${t.last50}`} />,
    },
    {
      label: t.blockTime,
      value: <bdi dir="ltr">{avg(secs).toFixed(1)}{t.seconds}</bdi>,
      hint: `${t.avg} · ${t.last50}`,
      extra: <Sparkline values={secs} label={`${t.blockTime}, ${t.last50}`} />,
    },
    {
      label: t.networkLoad,
      value: load === null ? "—" : null,
      extra: load === null ? null : <LoadMeter pct={load} labels={{ low: t.loadLow, medium: t.loadMedium, high: t.loadHigh }} />,
    },
    { label: t.totalSupply, value: <><bdi dir="ltr">{compact(ledger.total_coins, lang)}</bdi>{unit}</>, hint: <bdi dir="ltr">{formatAmount(ledger.total_coins, 0)}</bdi> },
    { label: t.feePool, value: <><bdi dir="ltr">{compact(ledger.fee_pool, lang)}</bdi>{unit}</> },
    {
      label: t.baseFee,
      value: <><bdi dir="ltr">{stroopsToPi(ledger.base_fee_in_stroops)}</bdi>{unit}</>,
      hint: <>{t.baseReserve} <bdi dir="ltr">{stroopsToPi(ledger.base_reserve_in_stroops)}</bdi></>,
    },
    { label: t.protocol, value: <bdi dir="ltr">v{ledger.protocol_version}</bdi>, hint: main ? t.mainnet : t.testnet },
  ];
  return (
      <StatsMore labels={{ more: insightDicts[lang].more, less: insightDicts[lang].less }}>
        {stats.map((st) => (
          <div className="stat" key={st.label}>
            <div className="label">{st.label}</div>
            {st.value !== null ? <div className="value">{st.value}</div> : null}
            {st.extra}
            {st.hint ? <div className="hint">{st.hint}</div> : null}
          </div>
        ))}
      </StatsMore>
  );
}

async function Today({ s }: { s: Settings }) {
  const { t, net, lang, native } = s;
  const today = statsEnabled() ? await getDaily(net, 1).then((r) => r[0] ?? null).catch(() => null) : null;
  return (
    <>
      {today ? (
        <section className="card today">
          <header className="card-head">
            <h2>{t.today}</h2>
            <Link href="/stats">{t.viewAll}</Link>
          </header>
          <div className="today-grid">
            <div><span>{insightDicts[lang].succeeded}</span><strong><bdi dir="ltr">{today.txs.toLocaleString("en")}</bdi></strong></div>
            <div><span>{t.payments}</span><strong><bdi dir="ltr">{today.payments.toLocaleString("en")}</bdi></strong></div>
            <div><span>{t.volume}</span><strong><bdi dir="ltr">{compact(today.payment_volume, lang)}</bdi> <small>{native}</small></strong></div>
            <div><span>{t.newAccounts}</span><strong><bdi dir="ltr">{today.new_accounts.toLocaleString("en")}</bdi></strong></div>
            <div>
              <span>{insightDicts[lang].successRate}</span>
              <strong><bdi dir="ltr">{today.txs + today.failed_txs ? ((today.txs / (today.txs + today.failed_txs)) * 100).toFixed(0) : "—"}%</bdi></strong>
              <small><bdi dir="ltr">{today.failed_txs.toLocaleString("en")}</bdi> {t.failedTx}</small>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

async function Price({ s }: { s: Settings }) {
  const points = await getCandles("7d");
  if (points.length < 2) return null;
  const { t, lang } = s;
  return (
    <PriceCard
      initial={points}
      locale={lang === "ar" ? "ar-EG-u-nu-latn" : "en"}
      labels={{ title: t.priceChart, source: t.priceSource, ranges: { "24h": t.range24h, "7d": t.range7d, "30d": t.range30d } }}
    />
  );
}

async function Feed({ s }: { s: Settings }) {
  const latest = await getLatest(s.net, s.native);
  const x = insightDicts[s.lang];
  return <LiveFeed initial={latest} t={s.t} lang={s.lang} horizon={horizonHost(s.net)} tabs={{ blocks: x.blocksTab, activity: x.activityTab }} />;
}

async function Insights({ s }: { s: Settings }) {
  const { t, net, lang, native } = s;
  const x = insightDicts[lang];
  const alerts = await getAlerts(net, ["foundation", "inflow_spike"], 4).catch(() => []);
  if (!alerts.length) return null;
  const now = Date.now();
  return (
    <section className="card">
      <header className="card-head">
        <h2>{x.recent}</h2>
        <Link href="/alerts">{t.viewAll}</Link>
      </header>
      <ul className="news">
        {alerts.map((a) => (
          <li key={a.id}>
            <Link href={a.tx_hash ? `/tx/${a.tx_hash}` : "/alerts"}>
              {a.kind === "foundation" ? x.kindFoundation : x.kindSpike}
              {a.amount ? <> · <bdi dir="ltr">{compact(Number(a.amount), lang)}</bdi> {native}</> : null}
            </Link>
            <div className="muted">
              {a.kind === "foundation" ? <>{x.dest[String(a.meta?.dest ?? "unknown")] ?? x.dest.unknown} · </> : null}
              <Ago iso={a.at} lang={lang} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
