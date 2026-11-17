import type { Metadata } from "next";
import { AccountLink, Amount, Card, DataTable, Mono, PageTitle, Pager } from "@/components/ui";
import { assetLabel, formatDate, shortId } from "@/lib/format";
import type { SearchParams } from "@/lib/found";
import { horizon, type Trade } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const revalidate = 60;
export const metadata: Metadata = { title: "Trades" };

function party(account?: string, pool?: string) {
  if (account) return <AccountLink id={account} />;
  if (pool) return <Mono title={pool}>LP {shortId(pool, 4, 4)}</Mono>;
  return "—";
}

export default async function Trades({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  const page = await paged((q) => horizon.trades(net, q), readPageParams((await getSettings(params)).q), 25);
  return (
    <>
      <PageTitle title={t.trades} />
      <Card>
        <DataTable<Trade>
          rows={page.records}
          rowKey={(x) => x.id}
          empty={t.noRecords}
          columns={[
            { label: t.base, cell: (x) => <Amount value={x.base_amount} asset={assetLabel(x.base_asset_type, x.base_asset_code, native)} />, className: "num" },
            { label: t.counter, cell: (x) => <Amount value={x.counter_amount} asset={assetLabel(x.counter_asset_type, x.counter_asset_code, native)} />, className: "num" },
            {
              label: t.priceCol,
              cell: (x) => (x.price ? <Mono>{(Number(x.price.n) / Number(x.price.d)).toPrecision(6)}</Mono> : "—"),
              className: "num",
            },
            { label: t.from, cell: (x) => party(x.base_account, x.base_liquidity_pool_id) },
            { label: t.to, cell: (x) => party(x.counter_account, x.counter_liquidity_pool_id) },
            { label: t.time, cell: (x) => formatDate(x.ledger_close_time, lang) },
          ]}
        />
        <Pager base="/trades" next={page.next} prev={page.prev} labels={t} />
      </Card>
    </>
  );
}
