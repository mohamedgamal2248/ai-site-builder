import type { Metadata } from "next";
import Link from "next/link";
import { NotConfigured } from "@/components/NotConfigured";
import { AccountLink, Amount, Card, DataTable, PageTitle, TxLink } from "@/components/ui";
import { formatAmount, formatDate } from "@/lib/format";
import type { SearchParams } from "@/lib/found";
import { largeThreshold } from "@/lib/ingest";
import { getSettings } from "@/lib/settings";
import { getLargest, statsEnabled, type LargeRow } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Largest transfers" };

const RANGES = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 } as const;

export default async function Largest({ searchParams }: { searchParams: SearchParams }) {
  const { t, net, lang, native } = await getSettings();
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={t.largest} />
        <NotConfigured t={t} />
      </>
    );
  }
  const sp = await searchParams;
  const range = (typeof sp.range === "string" && sp.range in RANGES ? sp.range : "24h") as keyof typeof RANGES;
  const rows = await getLargest(net, RANGES[range], 50);
  const labels = { "24h": t.range24h, "7d": t.range7d, "30d": t.range30d };

  return (
    <>
      <PageTitle title={t.largest} />
      <p className="muted">{t.largestNote.replace("{min}", formatAmount(String(largeThreshold())))}</p>
      <Card>
        <nav className="tabs range-tabs">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <Link key={r} href={`/largest?range=${r}`} className={r === range ? "active" : undefined}>
              {labels[r]}
            </Link>
          ))}
        </nav>
        <DataTable<LargeRow>
          rows={rows}
          rowKey={(r) => r.op_id}
          empty={t.noRecords}
          columns={[
            { label: t.amount, cell: (r) => <strong><Amount value={r.amount} asset={native} /></strong>, className: "num" },
            { label: t.from, cell: (r) => <AccountLink id={r.from_acc ?? ""} /> },
            { label: t.to, cell: (r) => <AccountLink id={r.to_acc ?? ""} /> },
            { label: t.type, cell: (r) => (r.kind === "payment" ? t.kindPayment : t.kindCreate) },
            { label: t.transaction, cell: (r) => <TxLink hash={r.tx_hash} /> },
            { label: t.time, cell: (r) => formatDate(r.ledger_time, lang) },
          ]}
        />
      </Card>
    </>
  );
}
