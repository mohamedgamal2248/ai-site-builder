import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { NotConfigured } from "@/components/NotConfigured";
import { Card, DataTable, PageTitle } from "@/components/ui";
import { compact, formatAmount, formatDate } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import Link from "next/link";
import type { SearchParams } from "@/lib/found";
import { bucketDaily, getDaily, getSync, statsEnabled, type DailyRow } from "@/lib/stats";

export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Statistics", "/stats");
}

const RANGES = { "30d": [30, "day"], "90d": [90, "week"], "1y": [365, "month"] } as const;

export default async function Stats({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={t.stats} />
        <NotConfigured t={t} />
      </>
    );
  }
  const sp = (await getSettings(params)).q;
  const range = (typeof sp.range === "string" && sp.range in RANGES ? sp.range : "30d") as keyof typeof RANGES;
  const [days, bucket] = RANGES[range];
  const [daily, sync] = await Promise.all([getDaily(net, days), getSync(net)]);
  const rows = bucketDaily(daily, bucket);
  const rangeLabels = { "30d": t.range30d, "90d": t.range90d, "1y": t.range1y };
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en";
  const short = (d: string) => (bucket === "month" ? d.slice(2, 7).replace("-", "/") : d.slice(5).replace("-", "/"));
  const last = sync.find((s) => s.stream === "operations")?.updated_at;

  const charts: { title: string; pick: (r: DailyRow) => number; fmt: (r: DailyRow) => string }[] = [
    { title: t.dailyTxs, pick: (r) => r.txs, fmt: (r) => r.txs.toLocaleString(locale) },
    { title: `${t.dailyVolume} (${native})`, pick: (r) => Number(r.payment_volume), fmt: (r) => `${formatAmount(r.payment_volume, 2)} ${native}` },
    { title: t.dailyAccounts, pick: (r) => r.new_accounts, fmt: (r) => r.new_accounts.toLocaleString(locale) },
    { title: `${t.dailyLocks} (${native})`, pick: (r) => Number(r.locked_amount), fmt: (r) => `${formatAmount(r.locked_amount, 2)} ${native}` },
  ];

  return (
    <>
      <PageTitle title={t.stats} sub={last ? `${t.syncedAt}: ${formatDate(last, lang)}` : undefined} />
      <nav className="tabs range-tabs" aria-label={t.range}>
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
          <Link key={r} href={r === "30d" ? "/stats" : `/stats?range=${r}`} className={r === range ? "active" : undefined}>
            {rangeLabels[r]}
          </Link>
        ))}
      </nav>
      <p className="muted">{t.last30}</p>
      {rows.length === 0 ? (
        <Card><p className="muted">{t.noRecords}</p></Card>
      ) : (
        <>
          <div className="grid-2">
            {charts.map((c) => (
              <Card key={c.title} title={c.title}>
                <BarChart
                  ariaLabel={c.title}
                  locale={locale}
                  bars={rows.map((r) => ({ key: r.day, label: short(r.day), value: c.pick(r), display: c.fmt(r) }))}
                />
              </Card>
            ))}
          </div>
          <Card>
            <DataTable<DailyRow>
              rows={[...rows].reverse()}
              rowKey={(r) => r.day}
              empty={t.noRecords}
              columns={[
                { label: t.day, cell: (r) => <bdi dir="ltr">{r.day}</bdi> },
                { label: t.transactions, cell: (r) => r.txs.toLocaleString("en"), className: "num" },
                { label: t.failedTx, cell: (r) => r.failed_txs.toLocaleString("en"), className: "num" },
                { label: t.operations, cell: (r) => r.ops.toLocaleString("en"), className: "num" },
                { label: t.payments, cell: (r) => r.payments.toLocaleString("en"), className: "num" },
                { label: t.volume, cell: (r) => <bdi dir="ltr">{compact(r.payment_volume, lang)}</bdi>, className: "num" },
                { label: t.newAccounts, cell: (r) => r.new_accounts.toLocaleString("en"), className: "num" },
                { label: t.locksCreated, cell: (r) => r.locks_created.toLocaleString("en"), className: "num" },
                { label: t.claims, cell: (r) => r.claims.toLocaleString("en"), className: "num" },
              ]}
            />
          </Card>
        </>
      )}
    </>
  );
}
