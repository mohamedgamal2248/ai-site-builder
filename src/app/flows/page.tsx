import type { Metadata } from "next";
import Link from "next/link";
import { BarChart } from "@/components/BarChart";
import { NotConfigured } from "@/components/NotConfigured";
import { WalletBadge } from "@/components/WalletBadge";
import { Card, DataTable, PageTitle } from "@/components/ui";
import { knownWallets } from "@/data/wallets";
import { compact, formatAmount } from "@/lib/format";
import type { SearchParams } from "@/lib/found";
import { getSettings } from "@/lib/settings";
import { getFlows, statsEnabled, type FlowRow } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Exchange flows" };

const RANGES = { "30d": 30, "90d": 90 } as const;

export default async function Flows({ searchParams }: { searchParams: SearchParams }) {
  const { t, net, lang, native } = await getSettings();
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={t.flows} />
        <NotConfigured t={t} />
      </>
    );
  }
  const sp = await searchParams;
  const range = (sp.range === "90d" ? "90d" : "30d") as keyof typeof RANGES;
  const exchanges = knownWallets.filter((w) => w.category === "exchange");
  const rows = await getFlows(net, exchanges.map((w) => w.address), RANGES[range]);
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en";
  const short = (d: string) => d.slice(5).replace("-", "/");

  // All exchanges combined, per day.
  const byDay = new Map<string, { inflow: number; outflow: number }>();
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { inflow: 0, outflow: 0 };
    d.inflow += Number(r.inflow);
    d.outflow += Number(r.outflow);
    byDay.set(r.day, d);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const sum = (f: (r: FlowRow) => number, addr?: string) => rows.filter((r) => !addr || r.address === addr).reduce((s, r) => s + f(r), 0);

  return (
    <>
      <PageTitle title={t.flows} />
      <p className="muted">{t.flowsIntro}</p>
      <nav className="tabs range-tabs">
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
          <Link key={r} href={r === "30d" ? "/flows" : `/flows?range=${r}`} className={r === range ? "active" : undefined}>
            {r === "30d" ? t.range30d : t.range90d}
          </Link>
        ))}
      </nav>

      <div className="stats">
        {exchanges.map((w) => {
          const net_ = sum((r) => Number(r.inflow) - Number(r.outflow), w.address);
          return (
            <div className="stat" key={w.address}>
              <div className="label" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <WalletBadge logo={w.logo} size={16} /> {w.label.split(" · ")[0]} · {t.netFlow}
              </div>
              <div className={`value ${net_ > 0 ? "down" : "up"}`}>
                <bdi dir="ltr">{net_ > 0 ? "+" : ""}{compact(net_, lang)}</bdi> <span className="unit">{native}</span>
              </div>
              <div className="hint">
                {t.inflow} <bdi dir="ltr">{compact(sum((r) => Number(r.inflow), w.address), lang)}</bdi> · {t.outflow}{" "}
                <bdi dir="ltr">{compact(sum((r) => Number(r.outflow), w.address), lang)}</bdi>
              </div>
            </div>
          );
        })}
      </div>

      <Card title={`${t.netFlow} (${native})`}>
        <div className="legend">
          <span><i className="in" />{t.inflow} &gt; {t.outflow}</span>
          <span><i className="out" />{t.outflow} &gt; {t.inflow}</span>
        </div>
        {days.length ? (
          <BarChart
            ariaLabel={t.netFlow}
            locale={locale}
            warmPositive
            bars={days.map(([d, f]) => {
              const v = f.inflow - f.outflow;
              // Net inflow (possible selling pressure) rises above the line in the warm colour.
              return { key: d, label: short(d), value: v, display: `${v > 0 ? "+" : ""}${formatAmount(v.toFixed(0))} ${native}` };
            })}
          />
        ) : (
          <p className="muted">{t.noRecords}</p>
        )}
        <p className="muted" style={{ fontSize: 12.5 }}>{t.netFlowNote}</p>
      </Card>

      <Card>
        <DataTable<[string, { inflow: number; outflow: number }]>
          rows={[...days].reverse()}
          rowKey={([d]) => d}
          empty={t.noRecords}
          columns={[
            { label: t.day, cell: ([d]) => <bdi dir="ltr">{d}</bdi> },
            { label: t.inflow, cell: ([, f]) => <bdi dir="ltr">{formatAmount(f.inflow.toFixed(0))}</bdi>, className: "num" },
            { label: t.outflow, cell: ([, f]) => <bdi dir="ltr">{formatAmount(f.outflow.toFixed(0))}</bdi>, className: "num" },
            {
              label: t.netFlow,
              cell: ([, f]) => {
                const v = f.inflow - f.outflow;
                return <bdi dir="ltr" className={v > 0 ? "down" : "up"}>{v > 0 ? "+" : ""}{formatAmount(v.toFixed(0))}</bdi>;
              },
              className: "num",
            },
          ]}
        />
      </Card>
    </>
  );
}
