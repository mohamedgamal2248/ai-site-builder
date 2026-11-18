import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { TxTable } from "@/components/TxTable";
import { Card, PageTitle, Pager } from "@/components/ui";
import type { SearchParams } from "@/lib/found";
import { horizon } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const revalidate = 30;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Transactions", "/txs");
}

export default async function Txs({ params }: { params: Promise<{ s: string }> }) {
  const s = await getSettings(params);
  const page = await paged((q) => horizon.transactions(s.net, q), readPageParams((await getSettings(params)).q), 25);
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
