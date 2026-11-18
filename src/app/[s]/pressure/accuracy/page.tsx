import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { NotConfigured } from "@/components/NotConfigured";
import { Card, DataTable, PageTitle } from "@/components/ui";
import { insightDicts } from "@/lib/i18n-insights";
import { getAccuracy } from "@/lib/insights";
import type { BacktestRow } from "@/lib/pindex";
import { getSettings } from "@/lib/settings";
import { statsEnabled } from "@/lib/stats";

export const revalidate = 3600;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Index track record", "/pressure/accuracy");
}

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`);

function Summary({ s, x }: { s: Awaited<ReturnType<typeof getAccuracy>>["live"]; x: (typeof insightDicts)["en"] }) {
  if (!s.calls) return <p className="muted">{x.collecting}</p>;
  return (
    <div className="stats">
      <div className="stat"><div className="label">{x.hitRate}</div><div className="value"><bdi dir="ltr">{s.hitRate === null ? "—" : `${Math.round(s.hitRate * 100)}%`}</bdi></div><div className="hint">{s.hits} / {s.calls} {x.calls}</div></div>
      <div className="stat"><div className="label">{x.afterSell}</div><div className={`value ${s.avgAfterSell !== null && s.avgAfterSell < 0 ? "down" : ""}`}><bdi dir="ltr">{pct(s.avgAfterSell)}</bdi></div></div>
      <div className="stat span-mobile"><div className="label">{x.afterBuy}</div><div className={`value ${s.avgAfterBuy !== null && s.avgAfterBuy > 0 ? "up" : ""}`}><bdi dir="ltr">{pct(s.avgAfterBuy)}</bdi></div></div>
    </div>
  );
}

export default async function Accuracy({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang } = await getSettings(params);
  const x = insightDicts[lang];
  if (!statsEnabled() || net !== "mainnet") {
    return (
      <>
        <PageTitle title={x.accuracyTitle} />
        <NotConfigured t={t} />
      </>
    );
  }
  const acc = await getAccuracy(net);
  return (
    <>
      <PageTitle title={x.accuracyTitle} />
      <p className="muted">{x.accuracyIntro}</p>
      <p className="muted" style={{ fontSize: 12.5 }}>{x.disclaimer}</p>
      <Card title={x.flowsRecord}>
        <Summary s={acc.flows.summary} x={x} />
        <p className="muted" style={{ fontSize: 12.5 }}>{x.callRule}</p>
        <DataTable<BacktestRow>
          rows={acc.flows.rows}
          rowKey={(r) => r.day}
          empty={x.collecting}
          columns={[
            { label: x.day, cell: (r) => <bdi dir="ltr">{r.day}</bdi> },
            { label: x.z, cell: (r) => <bdi dir="ltr">{r.z > 0 ? "+" : ""}{r.z.toFixed(2)}σ</bdi>, className: "num" },
            { label: x.call, cell: (r) => (r.call === "sell" ? <span className="down">{x.callSell}</span> : r.call === "buy" ? <span className="up">{x.callBuy}</span> : <span className="muted">{x.noCall}</span>) },
            { label: x.nextDay, cell: (r) => <bdi dir="ltr">{pct(r.nextReturn)}</bdi>, className: "num" },
            { label: x.result, cell: (r) => (r.hit === null ? "—" : r.hit ? <span className="badge ok">{x.right}</span> : <span className="badge bad">{x.wrong}</span>) },
          ]}
        />
      </Card>
      <Card title={x.liveRecord}>
        <Summary s={acc.live} x={x} />
        <p className="muted" style={{ fontSize: 12.5 }}>{x.liveRule}</p>
      </Card>
    </>
  );
}
