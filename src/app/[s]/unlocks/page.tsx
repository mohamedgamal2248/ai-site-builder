import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { Donut, HBars } from "@/components/Donut";
import { LineChart } from "@/components/LineChart";
import { NotConfigured } from "@/components/NotConfigured";
import { Amount, Card, DataTable, PageTitle } from "@/components/ui";
import { compact, formatAmount } from "@/lib/format";
import { horizon } from "@/lib/horizon";
import { getSettings } from "@/lib/settings";
import { AccountLink } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { insightDicts } from "@/lib/i18n-insights";
import { getUnlockPressure } from "@/lib/insights";
import { backfillProgress, getSync, getTopLocked, getLockupSnapshot, getUnlockCalendar, getUnlocks, statsEnabled, type LockedHolder, type UnlockMonth } from "@/lib/stats";

export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Unlock schedule", "/unlocks");
}

export default async function Unlocks({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={t.unlocks} />
        <NotConfigured t={t} />
      </>
    );
  }
  const [u, sync, ledger, top, cal, pressure, all, snapshot] = await Promise.all([
    getUnlocks(net, 24),
    getSync(net),
    horizon.ledgers(net, { limit: 1 }).then((p) => p.records[0]),
    getTopLocked(net, 25),
    getUnlockCalendar(net, 30),
    getUnlockPressure(net).catch(() => null),
    getUnlocks(net, 120),
    getLockupSnapshot(net).catch(() => null),
  ]);
  // Charts: share by year (three largest years + the rest), the biggest month's share,
  // the top months ranked, and the running total of Pi unlocking over time.
  const ar = lang === "ar";
  const monthName = (m: string) => new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  const yearsMap = new Map<string, number>();
  for (const m of all.months) yearsMap.set(m.month.slice(0, 4), (yearsMap.get(m.month.slice(0, 4)) ?? 0) + Number(m.amount));
  const years = [...yearsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const totalAll = years.reduce((sum, [, v]) => sum + v, 0);
  const topYears = [...years].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([y]) => y);
  const peakYear = [...years].sort((a, b) => b[1] - a[1])[0];
  const yearSlices = [
    ...years.filter(([y]) => topYears.includes(y)).map(([y, v], i) => ({ key: y, label: y, value: v, display: `${compact(v, lang)} ${native}`, tone: (i + 1) as 1 | 2 | 3 })),
    ...(years.length > 3 ? [{ key: "rest", label: ar ? "باقي السنين" : "Other years", value: years.filter(([y]) => !topYears.includes(y)).reduce((sum, [, v]) => sum + v, 0), display: "", tone: 0 as const }] : []),
  ].map((sl) => (sl.display ? sl : { ...sl, display: `${compact(sl.value, lang)} ${native}` }));
  const months24 = u.months.map((m) => ({ m: m.month, v: Number(m.amount) }));
  const total24 = months24.reduce((sum, m) => sum + m.v, 0);
  const peakMonth = [...months24].sort((a, b) => b.v - a.v)[0];
  const ranked = [...months24].sort((a, b) => b.v - a.v).slice(0, 6);
  let run = 0;
  const cumulative = all.months.map((m) => ({ t: Date.parse(`${m.month}-01T00:00:00Z`), v: (run += Number(m.amount)) }));
  const x = insightDicts[lang];
  const days = (v: number) => (pressure?.volumePi ? x.daysOfVolume.replace("{n}", (v / pressure.volumePi).toFixed(1)) : null);
  const progress = backfillProgress(sync.find((s) => s.stream === "claimable")?.cursor, ledger.sequence);
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en";

  return (
    <>
      <PageTitle title={t.unlocks} />
      <div className="stats">
        <div className="stat">
          <div className="label">{t.stillLocked}</div>
          <div className="value"><bdi dir="ltr">{compact(u.stillLocked, lang)}</bdi> {native}</div>
          <div className="hint"><bdi dir="ltr">{formatAmount(u.stillLocked, 0)}</bdi> · {u.stillLockedCount.toLocaleString(locale)} {t.lockupsCount}</div>
        </div>
        <div className="stat">
          <div className="label">{t.calendar}</div>
          <div className="value"><bdi dir="ltr">{compact(cal.reduce((sum, d) => sum + Number(d.amount), 0), lang)}</bdi> {native}</div>
          <div className="hint">{cal.reduce((sum, d) => sum + d.count, 0).toLocaleString(locale)} {t.lockupsCount}</div>
        </div>
        <div className="stat">
          <div className="label">{t.coverage}</div>
          <div className="value"><bdi dir="ltr">{progress.toFixed(1)}%</bdi></div>
          <div className="progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          {progress < 99.9 ? <div className="hint">{t.coverageNote}{snapshot ? ` (${snapshot.slice(0, 10)})` : ""}</div> : null}
        </div>
      </div>
      {pressure ? (
        <Card title={x.unlockPressure}>
          <div className="stats" style={{ marginBottom: 0 }}>
            <div className="stat">
              <div className="label">{x.next7}</div>
              <div className="value"><bdi dir="ltr">{compact(pressure.d7, lang)}</bdi> <span className="unit">{native}</span></div>
              {days(pressure.d7) ? <div className="hint">{days(pressure.d7)}</div> : null}
            </div>
            <div className="stat">
              <div className="label">{x.next30}</div>
              <div className="value"><bdi dir="ltr">{compact(pressure.d30, lang)}</bdi> <span className="unit">{native}</span></div>
              {days(pressure.d30) ? <div className="hint">{days(pressure.d30)}</div> : null}
            </div>
            <div className="stat span-mobile">
              <div className="label">{x.biggestDay}</div>
              <div className="value">{pressure.biggest ? <><bdi dir="ltr">{compact(pressure.biggest.amount, lang)}</bdi> <span className="unit">{native}</span></> : "—"}</div>
              {pressure.biggest ? <div className="hint"><bdi dir="ltr">{pressure.biggest.day}</bdi></div> : null}
            </div>
          </div>
        </Card>
      ) : null}
      {peakMonth && total24 > 0 ? (
        <div className="grid-2">
          <Card title={ar ? "أكبر شهر في فك القفل" : "Biggest unlock month"}>
            <Donut
              ariaLabel={ar ? "نصيب أكبر شهر" : "Biggest month's share"}
              center={`${((peakMonth.v / total24) * 100).toFixed(0)}%`}
              sub={ar ? "من الـ 24 شهر الجايين" : "of the next 24 months"}
              slices={[
                { key: "peak", label: monthName(peakMonth.m), value: peakMonth.v, display: `${compact(peakMonth.v, lang)} ${native}`, tone: 2 },
                { key: "rest", label: ar ? "باقي الشهور" : "All other months", value: total24 - peakMonth.v, display: `${compact(total24 - peakMonth.v, lang)} ${native}`, tone: 0 },
              ]}
            />
          </Card>
          <Card title={ar ? "فك القفل حسب السنة" : "Unlocks by year"}>
            <Donut ariaLabel={ar ? "فك القفل حسب السنة" : "Unlocks by year"} center={compact(totalAll, lang)} sub={native} slices={yearSlices} />
            {peakYear ? <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>{ar ? `أكتر سنة: ${peakYear[0]} (${((peakYear[1] / totalAll) * 100).toFixed(0)}% من الكل)` : `Biggest year: ${peakYear[0]} (${((peakYear[1] / totalAll) * 100).toFixed(0)}% of all)`}</p> : null}
          </Card>
        </div>
      ) : null}
      {ranked.length ? (
        <Card title={ar ? "أكتر الشهور اللي هيتفك فيها Pi" : "Months with the most Pi unlocking"}>
          <HBars
            ariaLabel={ar ? "أكتر الشهور" : "Top months"}
            peakLabel={ar ? "الأكبر" : "Top"}
            rows={ranked.map((r, i) => ({ key: r.m, label: monthName(r.m), value: r.v, display: `${compact(r.v, lang)} ${native}`, peak: i === 0 }))}
          />
        </Card>
      ) : null}
      {cumulative.length > 1 ? (
        <Card title={ar ? `إجمالي اللي هيتفك مع الوقت (${native})` : `Running total unlocking over time (${native})`}>
          <LineChart points={cumulative} decimals={0} locale={locale} timeMode="day" ariaLabel={ar ? "الإجمالي التراكمي" : "Cumulative total"} showChange={false} />
        </Card>
      ) : null}
      <Card title={`${t.calendar} (${native})`}>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t.calendarNote}</p>
        {cal.length ? (
          <BarChart
            ariaLabel={t.calendar}
            locale={locale}
            bars={cal.map((d) => ({ key: d.day, label: d.day.slice(5).replace("-", "/"), value: Number(d.amount), display: `${formatAmount(d.amount, 0)} ${native} · ${d.count} ${t.lockupsCount}` }))}
          />
        ) : (
          <p className="muted">{t.noRecords}</p>
        )}
      </Card>
      <Card title={`${t.unlockByMonth} (${native})`}>
        {u.months.length ? (
          <BarChart
            ariaLabel={t.unlockByMonth}
            locale={locale}
            bars={u.months.map((m) => ({ key: m.month, label: m.month.slice(2).replace("-", "/"), value: Number(m.amount), display: `${formatAmount(m.amount, 0)} ${native}`, highlight: m.month === peakMonth?.m }))}
          />
        ) : (
          <p className="muted">{t.noRecords}</p>
        )}
      </Card>
      <Card>
        <DataTable<UnlockMonth>
          rows={u.months}
          rowKey={(m) => m.month}
          empty={t.noRecords}
          columns={[
            { label: t.month, cell: (m) => <bdi dir="ltr">{m.month}</bdi> },
            { label: t.amount, cell: (m) => <Amount value={Number(m.amount).toFixed(0)} asset={native} />, className: "num" },
            { label: t.lockupsCount, cell: (m) => m.count.toLocaleString("en"), className: "num" },
          ]}
        />
      </Card>
      <Card title={t.topLocked}>
        <p className="muted" style={{ marginTop: 0 }}>{t.topLockedNote}</p>
        <DataTable<LockedHolder>
          rows={top}
          rowKey={(h) => h.claimant}
          empty={t.noRecords}
          columns={[
            { label: t.holder, cell: (h) => <AccountLink id={h.claimant} /> },
            { label: t.amount, cell: (h) => <Amount value={Number(h.amount).toFixed(0)} asset={native} />, className: "num" },
            { label: t.lockupsCount, cell: (h) => h.count.toLocaleString("en"), className: "num" },
            { label: t.unlocksAt, cell: (h) => (h.next_unlock ? formatDate(h.next_unlock, lang) : "—") },
          ]}
        />
      </Card>
    </>
  );
}
