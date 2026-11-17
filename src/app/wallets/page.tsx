import type { Metadata } from "next";
import { AccountLink, Amount, Card, DataTable, PageTitle } from "@/components/ui";
import { knownWallets, type KnownWallet } from "@/data/wallets";
import { horizon } from "@/lib/horizon";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Known wallets" };

export default async function Wallets() {
  const { t, net, native } = await getSettings();
  const list = net === "mainnet" ? knownWallets : [];
  const balances = await Promise.all(
    list.map((w) =>
      horizon
        .account(net, w.address)
        .then((a) => a.balances.find((b) => b.asset_type === "native")?.balance ?? "0")
        .catch(() => null),
    ),
  );
  const rows = list.map((w, i) => ({ ...w, balance: balances[i] }));

  return (
    <>
      <PageTitle title={t.wallets} />
      <p className="muted">{t.walletsIntro}</p>
      <Card>
        {rows.length ? (
          <DataTable<KnownWallet & { balance: string | null }>
            rows={rows}
            rowKey={(r) => r.address}
            empty={t.noRecords}
            columns={[
              { label: t.label, cell: (r) => <strong>{r.label}</strong> },
              { label: t.category, cell: (r) => r.category },
              { label: t.account, cell: (r) => <AccountLink id={r.address} /> },
              { label: t.balance, cell: (r) => (r.balance === null ? "—" : <Amount value={r.balance} asset={native} />), className: "num" },
              { label: t.sourceCol, cell: (r) => <a href={r.source} rel="nofollow noopener" target="_blank">↗</a> },
            ]}
          />
        ) : (
          <p className="notice">{t.walletsEmpty}</p>
        )}
      </Card>
    </>
  );
}
