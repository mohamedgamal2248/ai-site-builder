import type { Metadata } from "next";
import { TxTable } from "@/components/TxTable";
import { Card, PageTitle, Pager } from "@/components/ui";
import type { SearchParams } from "@/lib/found";
import { horizon } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transactions" };

export default async function Txs({ searchParams }: { searchParams: SearchParams }) {
  const s = await getSettings();
  const page = await paged((q) => horizon.transactions(s.net, q), readPageParams(await searchParams), 25);
  return (
    <>
      <PageTitle title={s.t.transactions} />
      <Card>
        <TxTable rows={page.records} s={s} />
        <Pager base="/txs" next={page.next} prev={page.prev} labels={s.t} />
      </Card>
    </>
  );
}
