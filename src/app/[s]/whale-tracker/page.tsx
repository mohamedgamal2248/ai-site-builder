import type { Metadata } from "next";
import { LineChart } from "@/components/LineChart";
import { NotConfigured } from "@/components/NotConfigured";
import { AccountLink, Card, PageTitle } from "@/components/ui";
import { knownWallets } from "@/data/wallets";
import { compact } from "@/lib/format";
import { insightDicts } from "@/lib/i18n-insights";
import { getTopTotals } from "@/lib/insights";
import { getSettings } from "@/lib/settings";
import { getWalletHistory, statsEnabled } from "@/lib/stats";

export const revalidate = 600;
export const metadata: Metadata = { title: "Whale tracker" };

function changeOver(points: { t: number; v: number }[], ms: number) {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  let base: { t: number; v: number } | null = null;
  for (const p of points) if (p.t <= last.t - ms) base = p;
  base ??= points[0].t <= last.t - ms * 0.5 ? points[0] : null;
  return base ? last.v - base.v : null;
}

function Change({ v, lang, native }: { v: number | null; lang: "ar" | "en"; native: string }) {
  if (v === null) return <span className="muted">—</span>;
  return (
    <span className={v > 0 ? "up" : v < 0 ? "down" : ""}>
      <bdi dir="ltr">{v > 0 ? "+" : ""}{compact(v, lang)}</bdi> <span className="unit">{native}</span>
    </span>
  );
}

export default async function WhaleTracker({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  const x = insightDicts[lang];
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={x.whaleTracker} />
        <NotConfigured t={t} />
      </>
    );
  }
  const whale = knownWallets.find((w) => w.category === "whale");
  const [tops, balances] = await Promise.all([getTopTotals(net, 24 * 30), getWalletHistory(net, 90)]);
  const whalePts = whale ? balances.filter((b) => b.address === whale.address).map((b) => ({ t: Date.parse(b.day), v: Number(b.balance) })) : [];
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en";
  const last = tops.at(-1)?.v ?? null;

  return (
    <>
      <PageTitle title={x.whaleTracker} />
      <p className="muted">{x.whaleIntro}</p>
      <div className="stats">
        <div className="stat"><div className="label">{x.top100}</div><div className="value">{last === null ? "—" : <><bdi dir="ltr">{compact(last, lang)}</bdi> <span className="unit">{native}</span></>}</div></div>
        <div className="stat"><div className="label">{x.change24}</div><div className="value"><Change v={changeOver(tops, 86_400_000)} lang={lang} native={native} /></div></div>
        <div className="stat span-mobile"><div className="label">{x.change7}</div><div className="value"><Change v={changeOver(tops, 7 * 86_400_000)} lang={lang} native={native} /></div></div>
      </div>
      <Card title={`${x.top100} (${native})`}>
        {tops.length > 1 ? <LineChart points={tops} decimals={0} locale={locale} timeMode="dayhour" ariaLabel={x.top100} /> : <p className="muted">{x.collecting}</p>}
      </Card>
      {whale ? (
        <Card title={x.trackedWhale}>
          <p style={{ marginTop: 0 }}><AccountLink id={whale.address} /></p>
          {whalePts.length > 1 ? <LineChart points={whalePts} decimals={0} locale={locale} timeMode="day" ariaLabel={x.trackedWhale} /> : <p className="muted">{x.collecting}</p>}
        </Card>
      ) : null}
    </>
  );
}
