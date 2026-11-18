import { pageMeta } from "@/lib/seo";
import { Ago } from "@/components/Ago";
import type { Metadata } from "next";
import { NotConfigured } from "@/components/NotConfigured";
import { AccountLink, Amount, Card, DataTable, PageTitle } from "@/components/ui";
import { HBars } from "@/components/Donut";
import { knownWallet } from "@/data/wallets";
import { compact } from "@/lib/format";
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
      {rows.length ? (
        <Card title={lang === "ar" ? "أكبر 10 حاملين" : "Top 10 holders"}>
          <HBars
            ariaLabel={lang === "ar" ? "أكبر 10 حاملين" : "Top 10 holders"}
            rows={rows.slice(0, 10).map((r) => {
              const k = knownWallet(r.account);
              return { key: r.account, label: k ? (lang === "ar" ? k.labelAr : k.label).split(" · ")[0] : `${r.account.slice(0, 5)}…${r.account.slice(-4)}`, value: Number(r.balance), display: `${compact(Number(r.balance), lang)} ${native}` };
            })}
          />
        </Card>
      ) : null}
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
