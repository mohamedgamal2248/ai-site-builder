import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { Gauge } from "@/components/Gauge";
import { DivergingBars } from "@/components/Donut";
import { LineChart } from "@/components/LineChart";
import { NotConfigured } from "@/components/NotConfigured";
import { Card, DataTable, PageTitle } from "@/components/ui";
import { compact } from "@/lib/format";
import { insightDicts } from "@/lib/i18n-insights";
import { getIndex, getIndexHistory } from "@/lib/insights";
import type { Component } from "@/lib/pindex";
import { getSettings } from "@/lib/settings";
import { statsEnabled } from "@/lib/stats";

export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Pi Pressure Index", "/pressure");
}

function fmtValue(c: Component, lang: "ar" | "en", native: string) {
  if (c.value === null) return "—";
  if (c.key === "order_book") return `${(c.value * 100).toFixed(1)}%`;
  if (c.key === "large_deposits") return String(Math.round(c.value));
  if (c.key === "unlocks") return `${compact(c.value, lang)} ${native}`;
  return `${c.value > 0 && c.key !== "foundation_out" ? "+" : ""}${compact(c.value, lang)} ${native}`;
}

export default async function IndexPage({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  const x = insightDicts[lang];
  if (!statsEnabled() || net !== "mainnet") {
    return (
      <>
        <PageTitle title={x.indexTitle} />
        <NotConfigured t={t} />
      </>
    );
  }
  const [idx, hist] = await Promise.all([getIndex(net), getIndexHistory(net, 168)]);
  const points = hist.filter((h) => h.score !== null).map((h) => ({ t: Date.parse(h.hour), v: h.score as number }));
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en";

  return (
    <>
      <PageTitle title={x.indexTitle} sub={x.updatedEvery} />
      <p className="muted">{x.indexIntro}</p>
      <section className="card index-hero">
        <Gauge score={idx.score} label={x.indexTitle} />
        <div>
          <div className="index-score"><bdi dir="ltr">{idx.score === null ? "—" : idx.score.toFixed(0)}</bdi><small>/100</small></div>
          <div className={`index-band band-${idx.band ?? "none"}`}>{idx.band ? x.bands[idx.band] : x.notEnough}</div>
          <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>{x.disclaimer}</p>
          <p style={{ margin: "8px 0 0" }}><Link href="/pressure/accuracy">{x.accuracy} ←</Link></p>
        </div>
      </section>

      <Card title={x.components}>
        <DivergingBars
          ariaLabel={x.components}
          labels={[lang === "ar" ? "← بيع · شراء →" : "← selling · buying →", ""]}
          rows={idx.components.map((c) => ({ key: c.key, label: x.names[c.key], value: c.available ? c.signal : null, display: c.available && c.signal !== null ? `${c.signal > 0 ? "+" : ""}${c.signal.toFixed(1)}` : "—" }))}
        />
        <div style={{ height: 14 }} />
        <DataTable<Component>
          rows={idx.components}
          rowKey={(c) => c.key}
          empty={t.noRecords}
          columns={[
            { label: x.signal, cell: (c) => <strong>{x.names[c.key]}</strong> },
            { label: x.now, cell: (c) => <bdi dir="ltr">{fmtValue(c, lang, native)}</bdi>, className: "num" },
            {
              label: x.normal,
              cell: (c) => (c.baseline === null || c.key === "unlocks" || c.key === "order_book" ? "—" : <bdi dir="ltr">{compact(c.baseline, lang)}</bdi>),
              className: "num",
            },
            {
              label: x.effect,
              cell: (c) =>
                !c.available || c.signal === null ? (
                  <span className="muted">{x.unavailable}</span>
                ) : (
                  <span className={c.signal > 0.3 ? "up" : c.signal < -0.3 ? "down" : "muted"}>
                    {c.signal > 0.3 ? x.bullish : c.signal < -0.3 ? x.bearish : x.flat} <bdi dir="ltr">({c.signal > 0 ? "+" : ""}{c.signal.toFixed(1)})</bdi>
                    {c.partial ? <span className="muted"> · {x.partial}</span> : null}
                  </span>
                ),
            },
            { label: x.weight, cell: (c) => `${Math.round(c.weight * 100)}%`, className: "num" },
          ]}
        />
      </Card>

      <Card title={x.history}>
        {points.length > 1 ? <LineChart points={points} decimals={0} locale={locale} timeMode="dayhour" ariaLabel={x.history} /> : <p className="muted">{x.collecting}</p>}
      </Card>
    </>
  );
}
