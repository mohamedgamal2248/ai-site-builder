import type { Metadata } from "next";
import { Card, DataTable, PageTitle } from "@/components/ui";
import { knownWallets } from "@/data/wallets";
import { compact, formatAmount } from "@/lib/format";
import { horizon } from "@/lib/horizon";
import { getMarket } from "@/lib/price";
import { getSettings } from "@/lib/settings";
import { backfillProgress, getLockedTotal, getSync, statsEnabled } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Supply" };

interface Slice {
  key: string;
  label: string;
  value: number;
  className: string;
  note?: string;
}

export default async function Supply() {
  const { t, net, lang, native } = await getSettings();
  const main = net === "mainnet";
  const [ledger, market, balances, locked, sync] = await Promise.all([
    horizon.ledgers(net, { limit: 1 }).then((p) => p.records[0]),
    main ? getMarket() : Promise.resolve(null),
    Promise.all(
      (main ? knownWallets : []).map((w) =>
        horizon
          .account(net, w.address)
          .then((a) => ({ w, bal: Number(a.balances.find((b) => b.asset_type === "native")?.balance ?? 0) }))
          .catch(() => ({ w, bal: 0 })),
      ),
    ),
    statsEnabled() ? getLockedTotal(net).catch(() => null) : Promise.resolve(null),
    statsEnabled() ? getSync(net).catch(() => []) : Promise.resolve([]),
  ]);
  const total = Number(ledger.total_coins);
  const foundation = balances.filter((b) => b.w.category === "foundation").reduce((s, b) => s + b.bal, 0);
  const exchanges = balances.filter((b) => b.w.category === "exchange").reduce((s, b) => s + b.bal, 0);
  const lockedPi = locked ? Number(locked.amount) : 0;
  const circulating = market?.circulating ?? 0;
  const progress = backfillProgress(sync.find((r) => r.stream === "claimable")?.cursor, ledger.sequence);

  // The bar shows non-overlapping parts: foundation, locked, circulating (which already contains exchange wallets), rest.
  const slices: Slice[] = [
    { key: "f", label: t.foundationHeld, value: foundation, className: "s-found" },
    { key: "l", label: t.lockedIndexed, value: lockedPi, className: "s-lock", note: progress < 99.9 ? `${t.coverage}: ${progress.toFixed(1)}%` : undefined },
    { key: "c", label: t.circulatingCg, value: circulating, className: "s-circ" },
  ];
  const known = slices.reduce((s, x) => s + x.value, 0);
  slices.push({ key: "r", label: t.remainder, value: Math.max(0, total - known), className: "s-rest" });
  const pct = (v: number) => (total ? (v / total) * 100 : 0);

  return (
    <>
      <PageTitle title={t.supply} sub={<><bdi dir="ltr">{formatAmount(total.toFixed(0))}</bdi> {native}</>} />
      <p className="muted">{t.supplyIntro}</p>
      <Card>
        <div className="supply-bar" role="img" aria-label={t.supply}>
          {slices.map((s) =>
            s.value > 0 ? <span key={s.key} className={s.className} style={{ width: `${Math.max(0.6, pct(s.value))}%` }} title={`${s.label}: ${pct(s.value).toFixed(1)}%`} /> : null,
          )}
        </div>
        <DataTable<Slice>
          rows={slices}
          rowKey={(s) => s.key}
          empty={t.noRecords}
          columns={[
            { label: t.category, cell: (s) => <span className="legend-row"><i className={s.className} />{s.label}</span> },
            { label: t.amount, cell: (s) => <><bdi dir="ltr">{compact(s.value, lang)}</bdi> {native}</>, className: "num" },
            { label: t.share, cell: (s) => <bdi dir="ltr">{pct(s.value).toFixed(2)}%</bdi>, className: "num" },
            { label: t.details, cell: (s) => <span className="muted">{s.note ?? ""}</span> },
          ]}
        />
      </Card>
      <Card>
        <p style={{ marginTop: 0 }}>
          {t.exchangeHeld}: <strong><bdi dir="ltr">{compact(exchanges, lang)}</bdi> {native}</strong>
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>{t.supplyNote}</p>
      </Card>
    </>
  );
}
