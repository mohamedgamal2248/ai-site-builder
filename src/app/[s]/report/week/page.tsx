import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertList } from "@/components/AlertList";
import { NotConfigured } from "@/components/NotConfigured";
import { AccountLink, Amount, Card, DataTable, PageTitle, TxLink } from "@/components/ui";
import { compact } from "@/lib/format";
import { extraDicts } from "@/lib/i18n-extra";
import { insightDicts } from "@/lib/i18n-insights";
import { getWeekReport, type WeekReport } from "@/lib/insights";
import { bandOf } from "@/lib/pindex";
import { getSettings } from "@/lib/settings";
import { statsEnabled } from "@/lib/stats";

export const revalidate = 3600;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Pi weekly report", "/report/week");
}

function Vs({ cur, prev, label }: { cur: number; prev: number | undefined; label: string }) {
  if (!prev) return null;
  const d = ((cur - prev) / prev) * 100;
  return <div className={`hint ${d >= 0 ? "up" : "down"}`}><bdi dir="ltr">{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)}%</bdi> <span className="muted">{label}</span></div>;
}

export default async function WeekReportPage({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  const w = extraDicts[lang].week;
  const x = insightDicts[lang];
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={w.title} />
        <NotConfigured t={t} />
      </>
    );
  }
  const r = await getWeekReport(net);
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en";
  const n = (v: number) => v.toLocaleString(locale);
  const change = r.open && r.close ? ((r.close - r.open) / r.open) * 100 : null;
  const band = bandOf(r.indexAvg);

  return (
    <>
      <PageTitle title={w.title} sub={<bdi dir="ltr">{r.from} → {r.to}</bdi>} />
      <p className="muted" style={{ marginTop: 0 }}>{w.intro.replace("{from}", r.from).replace("{to}", r.to)}</p>
      <nav className="report-nav"><Link href="/report">{w.daily} ←</Link><span /></nav>
      <div className="stats six">
        <div className="stat">
          <div className="label">{w.price}</div>
          <div className="value">{r.close ? <bdi dir="ltr">${r.close.toFixed(4)}</bdi> : "—"}</div>
          {change !== null ? <div className={`hint ${change >= 0 ? "up" : "down"}`}><bdi dir="ltr">{change >= 0 ? "+" : ""}{change.toFixed(2)}%</bdi></div> : null}
        </div>
        <div className="stat">
          <div className="label">{w.indexAvg}</div>
          <div className="value">{r.indexAvg === null ? "—" : <bdi dir="ltr">{r.indexAvg.toFixed(0)}/100</bdi>}</div>
          {band ? <div className="hint">{x.bands[band]}</div> : null}
        </div>
        <div className="stat">
          <div className="label">{w.netExch}</div>
          <div className={`value ${r.exchNet !== null && r.exchNet > 0 ? "down" : r.exchNet !== null && r.exchNet < 0 ? "up" : ""}`}>
            {r.exchNet === null ? "—" : <><bdi dir="ltr">{r.exchNet > 0 ? "+" : ""}{compact(r.exchNet, lang)}</bdi> <span className="unit">{native}</span></>}
          </div>
        </div>
        <div className="stat">
          <div className="label">{w.txs}</div>
          <div className="value"><bdi dir="ltr">{n(r.totals.txs)}</bdi></div>
          <Vs cur={r.totals.txs} prev={r.prevTotals?.txs} label={w.vsPrev} />
        </div>
        <div className="stat">
          <div className="label">{w.newAccounts}</div>
          <div className="value"><bdi dir="ltr">{n(r.totals.newAccounts)}</bdi></div>
          <Vs cur={r.totals.newAccounts} prev={r.prevTotals?.newAccounts} label={w.vsPrev} />
        </div>
        <div className="stat">
          <div className="label">{w.volume}</div>
          <div className="value"><bdi dir="ltr">{compact(r.totals.volume, lang)}</bdi> <span className="unit">{native}</span></div>
          <Vs cur={r.totals.volume} prev={r.prevTotals?.volume} label={w.vsPrev} />
        </div>
      </div>
      <Card title={x.foundationMoves}>
        {r.foundOut ? <p className="muted" style={{ marginTop: 0 }}>{w.foundOut}: <bdi dir="ltr">{compact(r.foundOut, lang)}</bdi> {native}</p> : null}
        <AlertList rows={r.foundation} x={x} lang={lang} native={native} empty={t.noRecords} />
      </Card>
      <Card title={x.biggestTransfers}>
        <DataTable<WeekReport["largest"][number]>
          rows={r.largest}
          rowKey={(p) => p.op_id}
          empty={t.noRecords}
          columns={[
            { label: "Pi", cell: (p) => <Amount value={Number(p.amount).toFixed(0)} asset={native} />, className: "num" },
            { label: "→", cell: (p) => <span className="op-summary">{p.from_acc ? <AccountLink id={p.from_acc} /> : "—"} <span className="muted">→</span> {p.to_acc ? <AccountLink id={p.to_acc} /> : "—"}</span>, m: "plain" },
            { label: "Tx", cell: (p) => <TxLink hash={p.tx_hash} />, m: "meta" },
          ]}
        />
      </Card>
    </>
  );
}
