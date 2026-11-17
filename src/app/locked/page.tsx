import type { Metadata } from "next";
import { AccountLink, Amount, Card, DataTable, PageTitle, Pager } from "@/components/ui";
import { canonicalAssetLabel, formatAmount, formatDate, lockOwner, unlockTime } from "@/lib/format";
import type { SearchParams } from "@/lib/found";
import { horizon, type ClaimableBalance } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Locked Pi" };

export default async function Locked({ searchParams }: { searchParams: SearchParams }) {
  const { t, net, lang, native } = await getSettings();
  const page = await paged((q) => horizon.claimableBalances(net, q), readPageParams(await searchParams), 25);
  const total = page.records.filter((c) => c.asset === "native").reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <>
      <PageTitle title={t.lockedTitle} />
      <p className="muted">{t.lockedIntro}</p>
      <Card>
        <p>
          {t.totalShown}: <strong><bdi dir="ltr">{formatAmount(total.toFixed(7))}</bdi> {native}</strong>
        </p>
        <DataTable<ClaimableBalance>
          rows={page.records}
          rowKey={(c) => c.id}
          empty={t.noRecords}
          columns={[
            { label: t.amount, cell: (c) => <Amount value={c.amount} asset={canonicalAssetLabel(c.asset, native)} />, className: "num" },
            { label: t.claimant, cell: (c) => <AccountLink id={lockOwner(c.claimants)?.destination ?? ""} /> },
            {
              label: t.unlocksAt,
              cell: (c) => {
                const owner = lockOwner(c.claimants);
                const at = owner ? unlockTime(owner.predicate) : null;
                return at && Date.parse(at) > Date.now() ? formatDate(at, lang) : <span className="badge ok">{t.claimableNow}</span>;
              },
            },
            { label: t.time, cell: (c) => formatDate(c.last_modified_time, lang) },
          ]}
        />
        <Pager base="/locked" next={page.next} prev={page.prev} labels={t} />
      </Card>
    </>
  );
}
