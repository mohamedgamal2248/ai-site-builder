import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NickButton } from "@/components/Nick";
import { Countdown } from "@/components/Countdown";
import { Donut } from "@/components/Donut";
import QRCode from "qrcode";
import { WatchButton } from "@/components/WatchButton";
import { knownWallet } from "@/data/wallets";
import { WalletBadge } from "@/components/WalletBadge";
import { OpTable } from "@/components/OpTable";
import { TxTable } from "@/components/TxTable";
import { AccountLink, Amount, Card, Copyable, DataTable, Facts, Pager } from "@/components/ui";
import { assetLabel, canonicalAssetLabel, compact, expiryTime, formatAmount, formatDate, lockOwner, shortId, unlockTime } from "@/lib/format";
import type { SearchParams } from "@/lib/found";
import { BalanceHistory } from "@/components/BalanceHistory";
import { horizon, horizonHost, HorizonError, type Account, type Balance, type ClaimableBalance } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings, parseSegment } from "@/lib/settings";
import { langAlternates } from "@/lib/seo";

// Rendered on first visit, then served from the CDN.
export async function generateStaticParams() {
  return [];
}
export const revalidate = 60;

type Params = Promise<{ s: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { s, id } = await params;
  const lang = parseSegment(s).lang;
  return { title: `${lang === "ar" ? "حساب" : "Account"} ${shortId(id, 5, 5)}`, alternates: langAlternates(lang, `/account/${id.toUpperCase()}`) };
}

/** Pi locked by the base reserve: (2 + subentries + sponsoring − sponsored) × base reserve. */
function reservedPi(a: Account, baseReserveStroops: number) {
  const entries = 2 + a.subentry_count + a.num_sponsoring - a.num_sponsored;
  return (entries * baseReserveStroops) / 1e7;
}

export default async function AccountPage({ params }: { params: Params }) {
  const s = await getSettings(params);
  const { t, net, lang, native } = s;
  const { id: raw } = await params;
  const id = raw.toUpperCase();
  if (!/^G[A-Z2-7]{55}$/.test(id)) notFound();
  const sp = (await getSettings(params)).q;
  const tab = sp.tab === "txs" ? "txs" : sp.tab === "locks" ? "locks" : sp.tab === "analytics" ? "analytics" : "ops";
  const pp = readPageParams(sp);

  const accountP = horizon.account(net, id).catch((e) => {
    if (e instanceof HorizonError && e.status === 404) return null;
    throw e;
  });
  const [account, ledger, locked, activity] = await Promise.all([
    accountP,
    horizon.ledgers(net, { limit: 1 }).then((p) => p.records[0]),
    horizon.accountClaimable(net, id).catch(() => ({ records: [] as ClaimableBalance[] })),
    tab === "locks" || tab === "analytics"
      ? Promise.resolve(null)
      : tab === "txs"
      ? paged((q) => horizon.accountTransactions(net, id, q), pp, 20).then((p) => ({ kind: "txs" as const, ...p }))
      : paged((q) => horizon.accountOperations(net, id, q), pp, 20).then((p) => ({ kind: "ops" as const, ...p })),
  ]).catch((e) => {
    if (e instanceof HorizonError && (e.status === 404 || e.status === 400)) return [null, null, { records: [] }, null] as const;
    throw e;
  });

  const qr = await QRCode.toString(id, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const known = knownWallet(id);
  const tabs: [string, string, string][] = [
    ["ops", t.operations, `/account/${id}`],
    ["txs", t.transactions, `/account/${id}?tab=txs`],
    ["locks", `${t.tabLocks} (${locked.records.length})`, `/account/${id}?tab=locks`],
    ["analytics", t.analytics, `/account/${id}?tab=analytics`],
  ];
  const analytics = tab === "analytics" ? await accountAnalytics(net, id) : null;
  const nativeBal = account?.balances.find((b) => b.asset_type === "native");
  const reserved = account && ledger ? reservedPi(account, ledger.base_reserve_in_stroops) : 0;
  // Nearest future unlock among the lockups this account owns.
  const nextUnlock = locked.records
    .filter((c) => c.asset === "native")
    .map((c) => {
      const owner = lockOwner(c.claimants.filter((x) => x.destination === id));
      const at = owner ? unlockTime(owner.predicate) : null;
      return at && Date.parse(at) > Date.now() ? { at, amount: Number(c.amount) } : null;
    })
    .filter((x): x is { at: string; amount: number } => !!x)
    .sort((a, b) => a.at.localeCompare(b.at));
  const soonest = nextUnlock[0] ? { at: nextUnlock[0].at, amount: nextUnlock.filter((n) => n.at === nextUnlock[0].at).reduce((sum, n) => sum + n.amount, 0) } : null;
  const lockedTotal = locked.records
    .filter((c) => c.asset === "native")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <>
      <section className="card account-head">
        <div className="account-main">
          <div className="account-title">
            <h1>{t.account}</h1>
            {known ? (
              <span className="id-link known">
                <WalletBadge logo={known.logo} size={20} />
                {lang === "ar" ? known.labelAr : known.label}
              </span>
            ) : null}
            <WatchButton id={id} labels={{ watch: t.watch, unwatch: t.unwatch }} />
            <Link className="btn-ghost small" href={`/compare?a=${id}`}>{lang === "ar" ? "قارن" : "Compare"}</Link>
            <NickButton id={id} labels={lang === "ar" ? { name: "سمّي المحفظة", rename: "اسمها", prompt: "اسم خاص (بيتحفظ عندك بس)", save: "احفظ", remove: "امسح" } : { name: "Name this wallet", rename: "Named", prompt: "Private name (saved on this device only)", save: "Save", remove: "Remove" }} />
          </div>
          <Copyable value={id} label={t.copy} copied={t.copied} />
          {typeof sp.muxed === "string" && /^\d{1,20}$/.test(sp.muxed) ? (
            <div className="known-banner">
              <span>
                {lang === "ar"
                  ? <>ده عنوان إيداع مشتق (muxed) برقم <bdi dir="ltr">{sp.muxed}</bdi>، والفلوس بتتسجل على الحساب الأساسي ده.</>
                  : <>That was a muxed deposit address with ID <bdi dir="ltr">{sp.muxed}</bdi>; funds settle in this base account.</>}
              </span>
            </div>
          ) : null}
          {known ? (
            <div className="known-banner">
              <span>
                {(lang === "ar" ? known.noteAr : known.note) ? <>{lang === "ar" ? known.noteAr : known.note}<br /></> : null}
                <span className="muted">{t.sourceCol}: {lang === "ar" ? known.sourceAr : known.source}</span>
              </span>
            </div>
          ) : null}
        </div>
        <div className="qr" role="img" aria-label={t.qrTitle} title={t.qrTitle} dangerouslySetInnerHTML={{ __html: qr }} />
      </section>

      {!account ? (
        <Card>
          <p className="notice">{t.accountNotFunded}</p>
        </Card>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="label">{t.balance}</div>
              <div className="value"><Amount value={nativeBal?.balance} asset={native} max={2} /></div>
            </div>
            <div className="stat">
              <div className="label">{t.available}</div>
              <div className="value">
                <Amount value={Math.max(0, Number(nativeBal?.balance ?? 0) - reserved - Number(nativeBal?.selling_liabilities ?? 0)).toFixed(7)} asset={native} max={2} />
              </div>
              <div className="hint">{t.reserved}: {formatAmount(reserved.toFixed(7))} {native}</div>
            </div>
            <div className="stat span-mobile">
              <div className="label">{t.locked}</div>
              <div className="value"><Amount value={lockedTotal.toFixed(7)} asset={native} max={2} /></div>
              <div className="hint">{locked.records.length} {lang === "ar" ? "رصيد" : locked.records.length === 1 ? "balance" : "balances"}</div>
            </div>
          </div>
          {Number(nativeBal?.balance ?? 0) + lockedTotal > 0 ? (
            <Card title={lang === "ar" ? "توزيع الرصيد" : "Balance breakdown"}>
              <Donut
                ariaLabel={lang === "ar" ? "توزيع الرصيد" : "Balance breakdown"}
                size={140}
                center={compact(Number(nativeBal?.balance ?? 0) + lockedTotal, lang)}
                sub={native}
                slices={[
                  { key: "a", label: t.available, value: Math.max(0, Number(nativeBal?.balance ?? 0) - reserved - Number(nativeBal?.selling_liabilities ?? 0)), display: `${compact(Math.max(0, Number(nativeBal?.balance ?? 0) - reserved - Number(nativeBal?.selling_liabilities ?? 0)), lang)} ${native}`, tone: 1 },
                  { key: "l", label: t.locked, value: lockedTotal, display: `${compact(lockedTotal, lang)} ${native}`, tone: 2 },
                  { key: "r", label: t.reserved, value: reserved, display: `${formatAmount(reserved.toFixed(7), 2)} ${native}`, tone: 0 },
                ]}
              />
            </Card>
          ) : null}
          <Card title={lang === "ar" ? "الرصيد مع الوقت" : "Balance over time"}>
            <BalanceHistory
              id={id}
              host={horizonHost(net)}
              balance={Number(nativeBal?.balance ?? 0)}
              locale={lang === "ar" ? "ar-EG-u-nu-latn" : "en"}
              ariaLabel={lang === "ar" ? "رصيد المحفظة مع الوقت" : "Wallet balance over time"}
              labels={
                lang === "ar"
                  ? { loading: "بيحمّل…", empty: "مفيش حركة كفاية لرسم المنحنى.", note: "محسوب من حركة المحفظة على البلوكتشين (من غير رسوم المعاملات).", partial: "بيعرض آخر 1000 حركة بس (من غير رسوم المعاملات)." }
                  : { loading: "Loading…", empty: "Not enough activity to draw a chart.", note: "Rebuilt from the wallet's on-chain activity (transaction fees not included).", partial: "Shows the latest 1,000 changes only (transaction fees not included)." }
              }
            />
          </Card>
          {soonest ? (
            <section className="card unlock-next">
              <div>
                <div className="label">{lang === "ar" ? "أقرب فك قفل" : "Next unlock"}</div>
                <div className="value"><Amount value={soonest.amount.toFixed(7)} asset={native} max={2} /></div>
                <div className="hint">{formatDate(soonest.at, lang)}{nextUnlock.length > 1 ? ` · ${lang === "ar" ? `و${nextUnlock.length - 1} رصيد تاني بعده` : `+${nextUnlock.length - 1} more later`}` : ""}</div>
              </div>
              <div className="unlock-actions">
                <Countdown to={soonest.at} lang={lang} />
                <a className="btn-ghost" href={`/api/ics?id=${id}&net=${net}&lang=${lang}`} download>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7 7v5m-2.5-2.5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  {lang === "ar" ? "ضيف للتقويم" : "Add to calendar"}
                </a>
              </div>
            </section>
          ) : null}

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

      <Card>
        <div className="tabs-row">
          <nav className="tabs" aria-label={lang === "ar" ? "أقسام الحساب" : "Account sections"}>
            {tabs.map(([k, label, href]) => (
              <Link key={k} href={href} className={tab === k ? "active" : undefined}>{label}</Link>
            ))}
          </nav>
          {tab === "ops" || tab === "txs" ? (
            <a className="btn ghost small" href={`/api/export/${id}?type=${tab}`} download>
              ⤓ {t.exportCsv}
            </a>
          ) : null}
        </div>
      {tab === "locks" ? (
        <>
          <DataTable<ClaimableBalance>
            rows={locked.records as ClaimableBalance[]}
            rowKey={(c) => c.id}
            empty={t.noRecords}
            columns={[
              { label: t.amount, cell: (c) => <Amount value={c.amount} asset={canonicalAssetLabel(c.asset, native)} /> },
              {
                label: t.unlocksAt,
                cell: (c) => {
                  const mine = c.claimants.find((x) => x.destination === id) ?? lockOwner(c.claimants)!;
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
        </>
      ) : analytics ? (
        <>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t.analyticsNote.replace("{n}", String(analytics.count))}</p>
          <div className="stats">
            <div className="stat"><div className="label">{t.received}</div><div className="value"><Amount value={analytics.received.toFixed(2)} asset={native} /></div></div>
            <div className="stat"><div className="label">{t.sent}</div><div className="value"><Amount value={analytics.sent.toFixed(2)} asset={native} /></div></div>
            <div className="stat span-mobile"><div className="label">{t.payments_n}</div><div className="value">{analytics.count}</div></div>
          </div>
          <h3 style={{ fontSize: 15, margin: "8px 0" }}>{t.counterparties}</h3>
          <DataTable<{ account: string; received: number; sent: number; n: number }>
            rows={analytics.top}
            rowKey={(r) => r.account}
            empty={t.noRecords}
            columns={[
              { label: t.account, cell: (r) => <AccountLink id={r.account} /> },
              { label: t.received, cell: (r) => <Amount value={r.received.toFixed(2)} />, className: "num" },
              { label: t.sent, cell: (r) => <Amount value={r.sent.toFixed(2)} />, className: "num" },
              { label: t.payments_n, cell: (r) => r.n, className: "num" },
            ]}
          />
        </>
      ) : activity ? (
        <>
          {activity.kind === "txs" ? <TxTable rows={activity.records} s={s} /> : <OpTable rows={activity.records} s={s} />}
          <Pager base={tab === "txs" ? `/account/${id}?tab=txs` : `/account/${id}`} next={activity.next} prev={activity.prev} labels={t} />
        </>
      ) : null}
      </Card>
    </>
  );
}

/** Totals and top counterparties from the account's latest 200 native payments. */
async function accountAnalytics(net: "mainnet" | "testnet", id: string) {
  const page = await horizon.accountPayments(net, id, 200).catch(() => ({ records: [] as never[] }));
  let received = 0;
  let sent = 0;
  let count = 0;
  const by = new Map<string, { account: string; received: number; sent: number; n: number }>();
  for (const o of page.records as { type: string; asset_type?: string; from?: string; to?: string; funder?: string; account?: string; amount?: string; starting_balance?: string; transaction_successful?: boolean }[]) {
    if (o.transaction_successful === false) continue;
    let from: string | undefined;
    let to: string | undefined;
    let amount = 0;
    if (o.type === "payment" && o.asset_type === "native") {
      from = o.from;
      to = o.to;
      amount = Number(o.amount);
    } else if (o.type === "create_account") {
      from = o.funder;
      to = o.account;
      amount = Number(o.starting_balance);
    } else continue;
    count++;
    const other = to === id ? from : to;
    if (!other) continue;
    const c = by.get(other) ?? { account: other, received: 0, sent: 0, n: 0 };
    if (to === id) {
      received += amount;
      c.received += amount;
    } else {
      sent += amount;
      c.sent += amount;
    }
    c.n++;
    by.set(other, c);
  }
  const top = [...by.values()].sort((a, b) => b.received + b.sent - (a.received + a.sent)).slice(0, 10);
  return { received, sent, count, top };
}
