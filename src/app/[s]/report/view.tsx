import Link from "next/link";
import { AlertList } from "@/components/AlertList";
import { NotConfigured } from "@/components/NotConfigured";
import { AccountLink, Amount, Card, DataTable, PageTitle, TxLink } from "@/components/ui";
import { compact } from "@/lib/format";
import { insightDicts } from "@/lib/i18n-insights";
import { getReport, type DayReport } from "@/lib/insights";
import { bandOf } from "@/lib/pindex";
import { getSettings } from "@/lib/settings";
import { statsEnabled } from "@/lib/stats";

export const shiftDay = (day: string, n: number) => new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10);
export const validDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && d >= "2025-02-20" && d <= new Date().toISOString().slice(0, 10);

export async function ReportView({ day, params }: { day: string; params: Promise<{ s: string }> | { s: string } }) {
  const { t, net, lang, native } = await getSettings(params);
  const x = insightDicts[lang];
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={x.reportTitle} />
        <NotConfigured t={t} />
      </>
    );
  }
  const r = await getReport(net, day);
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en";
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(day));
  const today = new Date().toISOString().slice(0, 10);
  const change = r.close && r.prevClose ? ((r.close - r.prevClose) / r.prevClose) * 100 : null;
  const band = bandOf(r.index);
  const n = (v: number) => v.toLocaleString(locale);

  return (
    <>
      <PageTitle title={x.reportTitle} sub={<bdi dir="ltr">{day}</bdi>} />
      <p className="muted" style={{ marginTop: 0 }}>{x.reportIntro.replace("{d}", dateLabel)}</p>
      <nav className="report-nav">
        <Link href={`/report/${shiftDay(day, -1)}`}>{x.prevDay}</Link>
        {day < today ? <Link href={`/report/${shiftDay(day, 1)}`}>{x.nextDayLink}</Link> : <span />}
      </nav>
      <div className="stats six">
        <div className="stat">
          <div className="label">{x.closePrice}</div>
          <div className="value">{r.close ? <bdi dir="ltr">${r.close.toFixed(4)}</bdi> : "—"}</div>
          {change !== null ? <div className={`hint ${change >= 0 ? "up" : "down"}`}><bdi dir="ltr">{change >= 0 ? "+" : ""}{change.toFixed(2)}%</bdi></div> : null}
        </div>
        <div className="stat">
          <div className="label">{x.indexEnd}</div>
          <div className="value">{r.index === null ? "—" : <bdi dir="ltr">{r.index.toFixed(0)}/100</bdi>}</div>
          {band ? <div className="hint">{x.bands[band]}</div> : null}
        </div>
        <div className="stat">
          <div className="label">{x.netIntoExchanges}</div>
          <div className={`value ${r.exchNet !== null && r.exchNet > 0 ? "down" : r.exchNet !== null && r.exchNet < 0 ? "up" : ""}`}>
            {r.exchNet === null ? "—" : <><bdi dir="ltr">{r.exchNet > 0 ? "+" : ""}{compact(r.exchNet, lang)}</bdi> <span className="unit">{native}</span></>}
          </div>
        </div>
        <div className="stat">
          <div className="label">{t.transactions}</div>
          <div className="value">{r.stats ? <bdi dir="ltr">{n(r.stats.txs)}</bdi> : "—"}</div>
        </div>
        <div className="stat">
          <div className="label">{t.volume}</div>
          <div className="value">{r.stats ? <><bdi dir="ltr">{compact(r.stats.payment_volume, lang)}</bdi> <span className="unit">{native}</span></> : "—"}</div>
        </div>
        <div className="stat">
          <div className="label">{t.newAccounts}</div>
          <div className="value">{r.stats ? <bdi dir="ltr">{n(r.stats.new_accounts)}</bdi> : "—"}</div>
        </div>
      </div>
      <Card title={x.foundationMoves}>
        <AlertList rows={r.foundation} x={x} lang={lang} native={native} empty={t.noRecords} />
      </Card>
      <Card title={x.biggestTransfers}>
        <DataTable<DayReport["largest"][number]>
          rows={r.largest}
          rowKey={(p) => p.op_id}
          empty={t.noRecords}
          columns={[
            { label: "Pi", cell: (p) => <Amount value={Number(p.amount).toFixed(0)} asset={native} />, className: "num" },
            { label: "→", cell: (p) => <span className="op-summary">{p.from_acc ? <AccountLink id={p.from_acc} /> : "—"} <span className="muted">→</span> {p.to_acc ? <AccountLink id={p.to_acc} /> : "—"}</span> },
            { label: "Tx", cell: (p) => <TxLink hash={p.tx_hash} /> },
          ]}
        />
      </Card>
    </>
  );
}
