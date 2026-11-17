import type { Metadata } from "next";
import Link from "next/link";
import { WalletBadge } from "@/components/WalletBadge";
import { Copyable, PageTitle } from "@/components/ui";
import { knownWallets, type KnownWallet, type WalletCategory } from "@/data/wallets";
import { compact, formatAmount } from "@/lib/format";
import { horizon } from "@/lib/horizon";
import { getSettings } from "@/lib/settings";
import { Sparkline } from "@/components/Sparkline";
import { getFlows, getWalletHistory, statsEnabled } from "@/lib/stats";

export const revalidate = 300;
export const metadata: Metadata = { title: "Known wallets" };

const TEXT = {
  en: {
    foundation: "Pi Foundation & Core Team",
    exchange: "Exchanges",
    whale: "Largest holders",
    exchangeWarn:
      "These are pooled exchange hot wallets. Your personal deposit address on an exchange is a muxed M… address derived from them. Never send Pi to the G… address without your own muxed ID, or the exchange may not credit you.",
    missing: "Gate.io and MEXC are not listed: no full address has been published by a verifiable source.",
    namesFrom: "Name source",
    total: "Total in listed wallets",
  },
  ar: {
    foundation: "Pi Foundation والكور تيم",
    exchange: "المنصات",
    whale: "أكبر الحاملين",
    exchangeWarn:
      "دي محافظ مجمّعة للمنصات. عنوان الإيداع بتاعك على المنصة بيكون عنوان M… مشتق منها. ما تحوّلش Pi على عنوان الـ G مباشرة من غير الـ muxed ID بتاع حسابك، وإلا ممكن الفلوس ما تتضافش لحسابك.",
    missing: "Gate.io وMEXC مش موجودين: مفيش عنوان كامل منشور من مصدر يتوثّق فيه.",
    namesFrom: "مصدر الاسم",
    total: "إجمالي المحافظ المعروضة",
  },
};

export default async function Wallets({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  const x = TEXT[lang];
  const list = net === "mainnet" ? knownWallets : [];
  const balances = await Promise.all(
    list.map((w) =>
      horizon
        .account(net, w.address)
        .then((a) => a.balances.find((b) => b.asset_type === "native")?.balance ?? "0")
        .catch(() => null),
    ),
  );
  const db = statsEnabled() && list.length > 0;
  const [hist, flows] = await Promise.all([
    db ? getWalletHistory(net, 90).catch(() => []) : Promise.resolve([]),
    db ? getFlows(net, list.map((w) => w.address), 30).catch(() => []) : Promise.resolve([]),
  ]);
  const rows = list.map((w, i) => ({
    ...w,
    balance: balances[i],
    history: hist.filter((h) => h.address === w.address).map((h) => Number(h.balance)),
    flowIn: flows.filter((f) => f.address === w.address).reduce((s, f) => s + Number(f.inflow), 0),
    flowOut: flows.filter((f) => f.address === w.address).reduce((s, f) => s + Number(f.outflow), 0),
  }));
  const total = rows.reduce((sum, r) => sum + Number(r.balance ?? 0), 0);
  const groups: WalletCategory[] = ["foundation", "exchange", "whale"];

  return (
    <>
      <PageTitle title={t.wallets} sub={rows.length ? <>{x.total}: <bdi dir="ltr">{compact(total, lang)}</bdi> {native}</> : undefined} />
      <p className="muted">{t.walletsIntro}</p>
      {rows.length === 0 ? <p className="notice">{t.walletsEmpty}</p> : null}
      {groups.map((g) => {
        const items = rows.filter((r) => r.category === g).sort((a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0));
        if (!items.length) return null;
        return (
          <section key={g}>
            <h2 className="section-title">
              <WalletBadge logo={g === "foundation" ? "pi" : g === "whale" ? "whale" : "okx"} size={20} />
              {x[g]}
            </h2>
            {g === "exchange" ? <p className="warn">⚠️ {x.exchangeWarn}</p> : null}
            <div className="wallet-grid">
              {items.map((w) => (
                <WalletCard key={w.address} w={w} lang={lang} native={native} namesFrom={x.namesFrom} copy={t.copy} copied={t.copied} labels={{ history: t.balanceHistory, flows: t.flows30, inflow: t.received, outflow: t.sent }} />
              ))}
            </div>
            {g === "exchange" ? <p className="muted" style={{ fontSize: 13 }}>{x.missing}</p> : null}
          </section>
        );
      })}
    </>
  );
}

function WalletCard({ w, lang, native, namesFrom, copy, copied, labels }: { w: KnownWallet & { balance: string | null; history: number[]; flowIn: number; flowOut: number }; lang: "ar" | "en"; native: string; namesFrom: string; copy: string; copied: string; labels: { history: string; flows: string; inflow: string; outflow: string } }) {
  const note = lang === "ar" ? w.noteAr : w.note;
  return (
    <article className="card wallet-card">
      <div className="wallet-head">
        <WalletBadge logo={w.logo} size={36} />
        <div style={{ minWidth: 0 }}>
          <Link href={`/account/${w.address}`}>
            <strong>{lang === "ar" ? w.labelAr : w.label}</strong>
          </Link>
          <Copyable value={w.address} label={copy} copied={copied} />
        </div>
      </div>
      <div className="wallet-balance">
        {w.balance === null ? "—" : <><bdi dir="ltr">{formatAmount(Number(w.balance).toFixed(0))}</bdi> <span className="unit">{native}</span></>}
      </div>
      {w.history.length > 1 ? <Sparkline values={w.history} label={labels.history} /> : null}
      {w.flowIn || w.flowOut ? (
        <div className="wallet-source">
          {labels.flows}: {labels.inflow} <bdi dir="ltr">{compact(w.flowIn, lang)}</bdi> · {labels.outflow} <bdi dir="ltr">{compact(w.flowOut, lang)}</bdi>
        </div>
      ) : null}
      {note ? <div className="wallet-note">{note}</div> : null}
      <div className="wallet-source">{namesFrom}: {lang === "ar" ? w.sourceAr : w.source}</div>
    </article>
  );
}
