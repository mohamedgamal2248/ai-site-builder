import type { Metadata } from "next";
import { OpTable } from "@/components/OpTable";
import { Card, PageTitle, Pager } from "@/components/ui";
import type { SearchParams } from "@/lib/found";
import { horizon } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const revalidate = 30;
export const metadata: Metadata = { title: "Operations" };

export default async function Operations({ params }: { params: Promise<{ s: string }> }) {
  const s = await getSettings(params);
  const page = await paged((q) => horizon.operations(s.net, q), readPageParams((await getSettings(params)).q), 25);
  return (
    <>
      <PageTitle title={s.t.operations} />
      <Card>
        <OpTable rows={page.records} s={s} />
        <Pager base="/operations" next={page.next} prev={page.prev} labels={s.t} />
      </Card>
    </>
  );
}
