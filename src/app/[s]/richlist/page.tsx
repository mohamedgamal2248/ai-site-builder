import { pageMeta } from "@/lib/seo";
import { Ago } from "@/components/Ago";
import type { Metadata } from "next";
import { NotConfigured } from "@/components/NotConfigured";
import { AccountLink, Amount, Card, DataTable, PageTitle } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { getHolders, statsEnabled, type HolderRow } from "@/lib/stats";

export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Top holders", "/richlist");
}

export default async function RichList({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={t.richlist} />
        <NotConfigured t={t} />
      </>
    );
  }
  const { rows, tracked } = await getHolders(net, 100);
  const now = Date.now();
  return (
    <>
      <PageTitle title={t.richlist} />
      <p className="muted">{t.richlistNote.replace("{n}", tracked.toLocaleString("en"))}</p>
      <Card>
        <DataTable<HolderRow & { i: number }>
          rows={rows.map((r, i) => ({ ...r, i: i + 1 }))}
          rowKey={(r) => r.account}
          empty={t.noRecords}
          columns={[
            { label: t.rank_, cell: (r) => <strong>{r.i}</strong> },
            { label: t.account, cell: (r) => <AccountLink id={r.account} /> },
            { label: t.balance, cell: (r) => <Amount value={Number(r.balance).toFixed(0)} asset={native} />, className: "num" },
            { label: t.updated, cell: (r) => (r.updated_at ? <Ago iso={r.updated_at} lang={lang} /> : "—") },
          ]}
        />
      </Card>
    </>
  );
}
