import type { Metadata } from "next";
import { Amount, Card, DataTable, Mono, PageTitle, Pager } from "@/components/ui";
import { canonicalAssetLabel, formatAmount, formatDate, shortId } from "@/lib/format";
import type { SearchParams } from "@/lib/found";
import { horizon, type LiquidityPool } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { title: "Liquidity pools" };

export default async function Pools({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  const page = await paged((q) => horizon.pools(net, q), readPageParams((await getSettings(params)).q), 25);
  return (
    <>
      <PageTitle title={t.pools} />
      <Card>
        <DataTable<LiquidityPool>
          rows={page.records}
          rowKey={(p) => p.id}
          empty={t.noRecords}
          columns={[
            { label: t.pool, cell: (p) => <Mono title={p.id}>{shortId(p.id, 6, 6)}</Mono> },
            {
              label: t.reserves,
              cell: (p) => (
                <span className="op-summary">
                  {p.reserves.map((r) => (
                    <Amount key={r.asset} value={r.amount} asset={canonicalAssetLabel(r.asset, native)} />
                  ))}
                </span>
              ),
            },
            { label: t.shares, cell: (p) => formatAmount(p.total_shares), className: "num" },
            { label: t.trustlines, cell: (p) => p.total_trustlines, className: "num" },
            { label: t.feeBp, cell: (p) => `${p.fee_bp / 100}%`, className: "num" },
            { label: t.lastModified, cell: (p) => formatDate(p.last_modified_time, lang) },
          ]}
        />
        <Pager base="/pools" next={page.next} prev={page.prev} labels={t} />
      </Card>
    </>
  );
}
