import type { Metadata } from "next";
import { AccountLink, Amount, Card, DataTable, PageTitle, Pager } from "@/components/ui";
import type { SearchParams } from "@/lib/found";
import { horizon, type Asset } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const revalidate = 300;
export const metadata: Metadata = { title: "Assets" };

export default async function Assets({ params }: { params: Promise<{ s: string }> }) {
  const { t, net } = await getSettings(params);
  const sp = (await getSettings(params)).q;
  const code = typeof sp.code === "string" && /^[a-zA-Z0-9]{1,12}$/.test(sp.code) ? sp.code.toUpperCase() : undefined;
  const page = await paged((q) => horizon.assets(net, { ...q, asset_code: code }), readPageParams(sp), 25);
  return (
    <>
      <PageTitle title={t.assets} sub={code} />
      <Card>
        <DataTable<Asset>
          rows={page.records}
          rowKey={(a) => a.paging_token}
          empty={t.noRecords}
          columns={[
            { label: t.code, cell: (a) => <strong>{a.asset_code}</strong> },
            { label: t.issuer, cell: (a) => <AccountLink id={a.asset_issuer} /> },
            { label: t.holders, cell: (a) => a.accounts.authorized.toLocaleString("en"), className: "num" },
            { label: t.supply, cell: (a) => <Amount value={a.balances.authorized} />, className: "num" },
            { label: t.pools, cell: (a) => a.num_liquidity_pools, className: "num" },
          ]}
        />
        <Pager base={code ? `/assets?code=${code}` : "/assets"} next={page.next} prev={page.prev} labels={t} />
      </Card>
    </>
  );
}
