import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { LineChart } from "@/components/LineChart";
import { NotConfigured } from "@/components/NotConfigured";
import { Card, PageTitle } from "@/components/ui";
import { extraDicts } from "@/lib/i18n-extra";
import { getGrowth } from "@/lib/insights";
import { getSettings } from "@/lib/settings";
import { statsEnabled } from "@/lib/stats";

export const revalidate = 1800;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Network growth", "/growth");
}

function Delta({ cur, prev, label }: { cur: number; prev: number; label: string }) {
  if (!prev) return null;
  const d = ((cur - prev) / prev) * 100;
  return (
    <div className={`hint ${d >= 0 ? "up" : "down"}`}>
      <bdi dir="ltr">{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)}%</bdi> <span className="muted">{label}</span>
    </div>
  );
}

export default async function Growth({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang } = await getSettings(params);
  const g = extraDicts[lang].growth;
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={g.title} />
        <NotConfigured t={t} />
      </>
    );
  }
  const rows = await getGrowth(net);
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en";
  type Row = (typeof rows)[number];
  const sum = (a: Row[], k: "accts" | "payments" | "txs" | "failed") => a.reduce((s, r) => s + r[k], 0);
  const last7 = rows.slice(-7);
  const prev7 = rows.slice(-14, -7);
  const rate = (a: Row[]) => (sum(a, "txs") + sum(a, "failed") ? (sum(a, "txs") / (sum(a, "txs") + sum(a, "failed"))) * 100 : 0);
  let acc = 0;
  const cumulative = rows.map((r) => ({ t: Date.parse(r.day), v: (acc += r.accts) }));
  const success = rows.filter((r) => r.txs + r.failed > 0).map((r) => ({ t: Date.parse(r.day), v: (r.txs / (r.txs + r.failed)) * 100 }));
  const short = (d: string) => d.slice(5).replace("-", "/");

  return (
    <>
      <PageTitle title={g.title} />
      <p className="muted">{g.intro}</p>
      <div className="stats">
        <div className="stat">
          <div className="label">{g.newAccounts7}</div>
          <div className="value"><bdi dir="ltr">{sum(last7, "accts").toLocaleString(locale)}</bdi></div>
          <Delta cur={sum(last7, "accts")} prev={sum(prev7, "accts")} label={g.vsPrev} />
        </div>
        <div className="stat">
          <div className="label">{g.payments7}</div>
          <div className="value"><bdi dir="ltr">{sum(last7, "payments").toLocaleString(locale)}</bdi></div>
          <Delta cur={sum(last7, "payments")} prev={sum(prev7, "payments")} label={g.vsPrev} />
        </div>
        <div className="stat span-mobile">
          <div className="label">{g.success7}</div>
          <div className="value"><bdi dir="ltr">{rate(last7).toFixed(1)}%</bdi></div>
          {prev7.length ? <div className="hint muted">{g.vsPrev}: <bdi dir="ltr">{rate(prev7).toFixed(1)}%</bdi></div> : null}
        </div>
      </div>
      {rows.length < 2 ? (
        <Card><p className="muted">{t.noRecords}</p></Card>
      ) : (
        <>
          <Card title={g.cumulative}>
            <LineChart points={cumulative} decimals={0} locale={locale} timeMode="day" ariaLabel={g.cumulative} showChange={false} />
          </Card>
          <div className="grid-2">
            <Card title={g.weekly}>
              <BarChart ariaLabel={g.weekly} locale={locale} bars={rows.slice(-30).map((r) => ({ key: r.day, label: short(r.day), value: r.accts, display: r.accts.toLocaleString(locale) }))} />
            </Card>
            <Card title={g.successTrend}>
              <LineChart points={success} decimals={1} locale={locale} timeMode="day" ariaLabel={g.successTrend} />
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>{g.note}</p>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
