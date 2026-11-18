import { pageMeta } from "@/lib/seo";
import { Ago } from "@/components/Ago";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NotConfigured } from "@/components/NotConfigured";
import { AccountLink, Amount, Card, DataTable, PageTitle, TxLink } from "@/components/ui";
import { formatDate, timeAgo } from "@/lib/format";
import type { SearchParams } from "@/lib/found";
import { getSettings } from "@/lib/settings";
import { getWhaleFeed, statsEnabled, type LargeRow } from "@/lib/stats";

export const revalidate = 60;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Whale alerts", "/whales");
}

const MINS = [10_000, 100_000, 1_000_000] as const;

export default async function Whales({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={t.whales} />
        <NotConfigured t={t} />
      </>
    );
  }
  const sp = (await getSettings(params)).q;
  const min = MINS.find((m) => String(m) === sp.min) ?? 100_000;
  const rows = await getWhaleFeed(net, { hours: 24 * 7, min, limit: 100 });
  const now = Date.now();

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageTitle title={t.whales} />
      <p className="muted">{t.whalesIntro}</p>
      <nav className="tabs range-tabs" aria-label={t.minAmount}>
        {MINS.map((m) => (
          <Link key={m} href={`/whales?min=${m}`} className={m === min ? "active" : undefined}>
            ≥ <bdi dir="ltr">{m.toLocaleString("en")}</bdi> {native}
          </Link>
        ))}
      </nav>
      <Card>
        <DataTable<LargeRow>
          rows={rows}
          rowKey={(r) => r.op_id}
          empty={t.noRecords}
          columns={[
            { label: t.amount, cell: (r) => <strong><Amount value={Number(r.amount).toFixed(0)} asset={native} /></strong> },
            { label: t.from, cell: (r) => <AccountLink id={r.from_acc ?? ""} /> },
            { label: t.to, cell: (r) => <AccountLink id={r.to_acc ?? ""} /> },
            { label: t.time, cell: (r) => <Ago iso={r.ledger_time} lang={lang} title={formatDate(r.ledger_time, lang)} /> },
            { label: t.transaction, cell: (r) => <TxLink hash={r.tx_hash} /> },
          ]}
        />
      </Card>
    </>
  );
}
