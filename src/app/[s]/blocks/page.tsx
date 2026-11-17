import type { Metadata } from "next";
import { Card, DataTable, LedgerLink, PageTitle, Pager, Mono } from "@/components/ui";
import { formatDate, shortId } from "@/lib/format";
import type { SearchParams } from "@/lib/found";
import { horizon, type Ledger } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const revalidate = 30;
export const metadata: Metadata = { title: "Blocks" };

export default async function Blocks({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang } = await getSettings(params);
  const page = await paged((q) => horizon.ledgers(net, q), readPageParams((await getSettings(params)).q), 25);
  return (
    <>
      <PageTitle title={t.blocks} />
      <Card>
        <DataTable<Ledger>
          rows={page.records}
          rowKey={(l) => l.id}
          empty={t.noRecords}
          columns={[
            { label: t.block, cell: (l) => <LedgerLink seq={l.sequence} /> },
            { label: t.closedAt, cell: (l) => formatDate(l.closed_at, lang) },
            { label: t.txCount, cell: (l) => `${l.successful_transaction_count}${l.failed_transaction_count ? ` (+${l.failed_transaction_count} ${t.failedTx})` : ""}`, className: "num" },
            { label: t.opCount, cell: (l) => l.operation_count, className: "num" },
            { label: t.hash, cell: (l) => <Mono title={l.hash}>{shortId(l.hash, 8, 8)}</Mono> },
          ]}
        />
        <Pager base="/blocks" next={page.next} prev={page.prev} labels={t} />
      </Card>
    </>
  );
}
