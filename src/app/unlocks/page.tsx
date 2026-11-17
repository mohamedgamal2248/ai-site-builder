import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { NotConfigured } from "@/components/NotConfigured";
import { Amount, Card, DataTable, PageTitle } from "@/components/ui";
import { compact, formatAmount } from "@/lib/format";
import { horizon } from "@/lib/horizon";
import { getSettings } from "@/lib/settings";
import { backfillProgress, getSync, getUnlocks, statsEnabled, type UnlockMonth } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unlock schedule" };

export default async function Unlocks() {
  const { t, net, lang, native } = await getSettings();
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={t.unlocks} />
        <NotConfigured t={t} />
      </>
    );
  }
  const [u, sync, ledger] = await Promise.all([
    getUnlocks(net, 24),
    getSync(net),
    horizon.ledgers(net, { limit: 1 }).then((p) => p.records[0]),
  ]);
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
          <div className="label">{t.unlockedUnclaimed}</div>
          <div className="value"><bdi dir="ltr">{compact(u.unlockedUnclaimed, lang)}</bdi> {native}</div>
          <div className="hint">{u.unlockedUnclaimedCount.toLocaleString(locale)} {t.lockupsCount}</div>
        </div>
        <div className="stat">
          <div className="label">{t.coverage}</div>
          <div className="value"><bdi dir="ltr">{progress.toFixed(1)}%</bdi></div>
          <div className="progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          {progress < 99.9 ? <div className="hint">{t.coverageNote}</div> : null}
        </div>
      </div>
      <Card title={`${t.unlockByMonth} (${native})`}>
        {u.months.length ? (
          <BarChart
            ariaLabel={t.unlockByMonth}
            locale={locale}
            bars={u.months.map((m) => ({ key: m.month, label: m.month.slice(2).replace("-", "/"), value: Number(m.amount), display: `${formatAmount(m.amount, 0)} ${native}` }))}
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
    </>
  );
}
