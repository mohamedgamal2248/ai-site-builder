import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OpTable } from "@/components/OpTable";
import { TxTable } from "@/components/TxTable";
import { AccountLink, Amount, Card, Copyable, DataTable, Facts, PageTitle, Pager } from "@/components/ui";
import { assetLabel, canonicalAssetLabel, expiryTime, formatAmount, formatDate, shortId, unlockTime } from "@/lib/format";
import type { SearchParams } from "@/lib/found";
import { horizon, HorizonError, type Account, type Balance, type ClaimableBalance } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `Account ${shortId((await params).id, 5, 5)}` };
}

/** Pi locked by the base reserve: (2 + subentries + sponsoring − sponsored) × base reserve. */
function reservedPi(a: Account, baseReserveStroops: number) {
  const entries = 2 + a.subentry_count + a.num_sponsoring - a.num_sponsored;
  return (entries * baseReserveStroops) / 1e7;
}

export default async function AccountPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const s = await getSettings();
  const { t, net, lang, native } = s;
  const { id: raw } = await params;
  const id = raw.toUpperCase();
  if (!/^G[A-Z2-7]{55}$/.test(id)) notFound();
  const sp = await searchParams;
  const tab = sp.tab === "txs" ? "txs" : "ops";
  const pp = readPageParams(sp);

  const accountP = horizon.account(net, id).catch((e) => {
    if (e instanceof HorizonError && e.status === 404) return null;
    throw e;
  });
  const [account, ledger, locked, activity] = await Promise.all([
    accountP,
    horizon.ledgers(net, { limit: 1 }).then((p) => p.records[0]),
    horizon.accountClaimable(net, id).catch(() => ({ records: [] as ClaimableBalance[] })),
    tab === "txs"
      ? paged((q) => horizon.accountTransactions(net, id, q), pp, 20).then((p) => ({ kind: "txs" as const, ...p }))
      : paged((q) => horizon.accountOperations(net, id, q), pp, 20).then((p) => ({ kind: "ops" as const, ...p })),
  ]).catch((e) => {
    if (e instanceof HorizonError && (e.status === 404 || e.status === 400)) return [null, null, { records: [] }, null] as const;
    throw e;
  });

  const nativeBal = account?.balances.find((b) => b.asset_type === "native");
  const reserved = account && ledger ? reservedPi(account, ledger.base_reserve_in_stroops) : 0;
  const lockedTotal = locked.records
    .filter((c) => c.asset === "native")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <>
      <PageTitle title={t.account} sub={<Copyable value={id} label={t.copy} copied={t.copied} />} />

      {!account ? (
        <Card>
          <p className="notice">{t.accountNotFunded}</p>
        </Card>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="label">{t.balance}</div>
              <div className="value"><Amount value={nativeBal?.balance} asset={native} /></div>
            </div>
            <div className="stat">
              <div className="label">{t.available}</div>
              <div className="value">
                <Amount value={Math.max(0, Number(nativeBal?.balance ?? 0) - reserved - Number(nativeBal?.selling_liabilities ?? 0)).toFixed(7)} asset={native} />
              </div>
              <div className="hint">{t.reserved}: {formatAmount(reserved.toFixed(7))} {native}</div>
            </div>
            <div className="stat">
              <div className="label">{t.locked}</div>
              <div className="value"><Amount value={lockedTotal.toFixed(7)} asset={native} /></div>
              <div className="hint">{locked.records.length} {lang === "ar" ? "رصيد" : locked.records.length === 1 ? "balance" : "balances"}</div>
            </div>
          </div>

          <Card>
            <Facts
              rows={[
                [t.homeDomain, account.home_domain || t.none],
                [t.subentries, account.subentry_count],
                [t.sponsoring, `${account.num_sponsoring} / ${account.num_sponsored}`],
                [t.thresholds, `${account.thresholds.low_threshold} / ${account.thresholds.med_threshold} / ${account.thresholds.high_threshold}`],
                [t.lastModified, formatDate(account.last_modified_time, lang)],
                [t.sequence, <bdi key="s" className="mono" dir="ltr">{account.sequence}</bdi>],
              ]}
            />
          </Card>

          {account.balances.length > 1 ? (
            <Card title={t.balances}>
              <DataTable<Balance>
                rows={account.balances}
                rowKey={(b) => `${b.asset_type}:${b.asset_code ?? ""}:${b.asset_issuer ?? b.liquidity_pool_id ?? ""}`}
                empty={t.noRecords}
                columns={[
                  { label: t.asset, cell: (b) => <strong>{assetLabel(b.asset_type, b.asset_code, native)}</strong> },
                  { label: t.balance, cell: (b) => <Amount value={b.balance} />, className: "num" },
                  { label: t.issuer, cell: (b) => (b.asset_issuer ? <AccountLink id={b.asset_issuer} /> : "—") },
                  { label: t.limit, cell: (b) => (b.limit ? formatAmount(b.limit) : "—"), className: "num" },
                ]}
              />
            </Card>
          ) : null}

          {account.signers.length > 1 ? (
            <Card title={t.signers}>
              <DataTable
                rows={account.signers}
                rowKey={(x) => x.key}
                empty={t.noRecords}
                columns={[
                  { label: t.account, cell: (x) => (x.type === "ed25519_public_key" ? <AccountLink id={x.key} /> : <bdi className="mono" dir="ltr">{shortId(x.key)}</bdi>) },
                  { label: t.type, cell: (x) => x.type },
                  { label: t.weight, cell: (x) => x.weight, className: "num" },
                ]}
              />
            </Card>
          ) : null}
        </>
      )}

      {locked.records.length ? (
        <Card title={t.lockedBalances}>
          <DataTable<ClaimableBalance>
            rows={locked.records as ClaimableBalance[]}
            rowKey={(c) => c.id}
            empty={t.noRecords}
            columns={[
              { label: t.amount, cell: (c) => <Amount value={c.amount} asset={canonicalAssetLabel(c.asset, native)} /> },
              {
                label: t.unlocksAt,
                cell: (c) => {
                  const mine = c.claimants.find((x) => x.destination === id) ?? c.claimants[0];
                  const at = unlockTime(mine.predicate);
                  const exp = expiryTime(mine.predicate);
                  if (at && Date.parse(at) > Date.now()) return formatDate(at, lang);
                  return (
                    <span>
                      <span className="badge ok">{t.claimableNow}</span>
                      {exp ? <span className="muted"> · {t.expires} {formatDate(exp, lang)}</span> : null}
                    </span>
                  );
                },
              },
              { label: t.sponsor, cell: (c) => (c.sponsor ? <AccountLink id={c.sponsor} /> : "—") },
            ]}
          />
        </Card>
      ) : null}

      {activity ? (
        <Card>
          <nav className="tabs">
            <Link href={`/account/${id}`} className={tab === "ops" ? "active" : undefined}>{t.operations}</Link>
            <Link href={`/account/${id}?tab=txs`} className={tab === "txs" ? "active" : undefined}>{t.transactions}</Link>
          </nav>
          {activity.kind === "txs" ? <TxTable rows={activity.records} s={s} /> : <OpTable rows={activity.records} s={s} />}
          <Pager base={tab === "txs" ? `/account/${id}?tab=txs` : `/account/${id}`} next={activity.next} prev={activity.prev} labels={t} />
        </Card>
      ) : null}
    </>
  );
}
