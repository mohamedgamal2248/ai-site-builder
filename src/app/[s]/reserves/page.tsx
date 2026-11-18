import type { Metadata } from "next";
import Link from "next/link";
import { BarChart } from "@/components/BarChart";
import { Donut } from "@/components/Donut";
import { LineChart } from "@/components/LineChart";
import { NotConfigured } from "@/components/NotConfigured";
import { WalletBadge } from "@/components/WalletBadge";
import { Card, PageTitle } from "@/components/ui";
import { knownWallets } from "@/data/wallets";
import { compact } from "@/lib/format";
import { horizon } from "@/lib/horizon";
import { pageMeta } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { getFlows, statsEnabled } from "@/lib/stats";

export const revalidate = 600;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Exchange reserves", "/reserves");
}

const DAYS = 90;
const DAY = 86_400_000;

/**
 * Pi held by the exchanges' known wallets, day by day. Today's balance comes from Horizon;
 * earlier days are rebuilt by taking each day's net flow back off it.
 */
export default async function Reserves({ params }: { params: Promise<{ s: string }> }) {
  const { lang, net, native } = await getSettings(params);
  const ar = lang === "ar";
  const L = ar
    ? { title: "احتياطيات المنصات", sub: "رصيد Pi في محافظ المنصات المعروفة يوم بيوم. لو الاحتياطي بيزيد، يبقى Pi بيدخل المنصات (ممكن للبيع)؛ لو بيقل، الناس بتسحب.", total: "إجمالي الاحتياطي", d7: "تغيّر 7 أيام", d30: "تغيّر 30 يوم", share: "حصة كل منصة", trend: `الاحتياطي آخر ${DAYS} يوم`, daily: "صافي التغيّر اليومي", note: "محسوب من رصيد النهارده وصافي التدفقات اليومية للمحافظ المعروفة بس، فالمنصة ممكن يكون عندها محافظ تانية.", flows: "تفاصيل التدفقات", filling: "بيزيد", draining: "بيقل" }
    : { title: "Exchange reserves", sub: "Pi held in known exchange wallets, day by day. Rising reserves mean Pi is moving onto exchanges (possibly to sell); falling reserves mean people are withdrawing.", total: "Total reserves", d7: "7-day change", d30: "30-day change", share: "Share by exchange", trend: `Reserves, last ${DAYS} days`, daily: "Daily net change", note: "Rebuilt from today's balance and the daily net flows of known wallets only; exchanges may hold other wallets too.", flows: "Flow details", filling: "rising", draining: "falling" };

  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={L.title} />
        <NotConfigured t={(await getSettings(params)).t} />
      </>
    );
  }

  const exchanges = knownWallets.filter((w) => w.category === "exchange");
  const [balances, flows] = await Promise.all([
    Promise.all(exchanges.map((w) => horizon.account(net, w.address).then((a) => Number(a.balances.find((b) => b.asset_type === "native")?.balance ?? 0)).catch(() => 0))),
    getFlows(net, exchanges.map((w) => w.address), DAYS),
  ]);

  // Net flow per wallet per day.
  const netBy = new Map<string, number>();
  for (const r of flows) netBy.set(`${r.address}|${r.day}`, Number(r.inflow) - Number(r.outflow));
  const today = new Date();
  const days: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) days.push(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - i * DAY).toISOString().slice(0, 10));

  // series[w][i] = balance at the end of days[i], walking back from today's balance.
  const series = exchanges.map((w, wi) => {
    const out = new Array<number>(days.length);
    let v = balances[wi];
    for (let i = days.length - 1; i >= 0; i--) {
      out[i] = Math.max(0, v);
      v -= netBy.get(`${w.address}|${days[i]}`) ?? 0;
    }
    return out;
  });
  const total = days.map((_, i) => series.reduce((s, x) => s + x[i], 0));
  const now = total.at(-1) ?? 0;
  const change = (n: number) => now - (total[total.length - 1 - n] ?? now);
  const locale = ar ? "ar-EG-u-nu-latn" : "en";
  const sign = (n: number) => `${n > 0 ? "+" : ""}${compact(n, lang)}`;
  const short = (d: string) => d.slice(5).replace("-", "/");
  const daily = days.map((d, i) => ({ d, v: i ? total[i] - total[i - 1] : 0 })).slice(-30);

  return (
    <>
      <PageTitle title={L.title} sub={L.sub} />
      <div className="stats">
        <div className="stat">
          <div className="label">{L.total}</div>
          <div className="value"><bdi dir="ltr">{compact(now, lang)}</bdi> <span className="unit">{native}</span></div>
        </div>
        {[7, 30].map((n) => (
          <div className="stat" key={n}>
            <div className="label">{n === 7 ? L.d7 : L.d30}</div>
            {/* More Pi on exchanges is sell-side supply, so a rise reads as the warning colour. */}
            <div className={`value ${change(n) > 0 ? "down" : change(n) < 0 ? "up" : ""}`}><bdi dir="ltr">{sign(change(n))}</bdi> <span className="unit">{native}</span></div>
            <div className="hint">{change(n) > 0 ? L.filling : change(n) < 0 ? L.draining : "—"}</div>
          </div>
        ))}
      </div>

      <Card title={L.trend}>
        <LineChart points={days.map((d, i) => ({ t: Date.parse(d), v: total[i] }))} decimals={0} locale={locale} timeMode="day" ariaLabel={L.trend} />
      </Card>

      <div className="grid-2">
        <Card title={L.share}>
          <Donut
            ariaLabel={L.share}
            size={150}
            center={compact(now, lang)}
            sub={native}
            slices={exchanges.slice(0, 3).map((w, i) => ({ key: w.address, label: w.label.split(" · ")[0], value: balances[i], display: `${compact(balances[i], lang)} ${native}`, tone: (i + 1) as 1 | 2 | 3 }))}
          />
        </Card>
        <Card title={L.daily}>
          <BarChart warmPositive ariaLabel={L.daily} locale={locale} bars={daily.map((x) => ({ key: x.d, label: short(x.d), value: x.v, display: `${sign(x.v)} ${native}` }))} />
        </Card>
      </div>

      <div className="grid-2">
        {exchanges.map((w, i) => (
          <Card key={w.address} title={<span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><WalletBadge logo={w.logo} size={18} /> {ar ? w.labelAr : w.label}</span>}>
            <div className="value" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}><bdi dir="ltr">{compact(balances[i], lang)}</bdi> <span className="unit">{native}</span></div>
            <LineChart points={days.map((d, j) => ({ t: Date.parse(d), v: series[i][j] }))} decimals={0} locale={locale} timeMode="day" ariaLabel={`${w.label} ${L.trend}`} />
          </Card>
        ))}
      </div>
      <p className="muted chart-note">{L.note} <Link href="/flows">{L.flows} →</Link></p>
    </>
  );
}
