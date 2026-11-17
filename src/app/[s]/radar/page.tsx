import type { Metadata } from "next";
import { AlertList } from "@/components/AlertList";
import { NotConfigured } from "@/components/NotConfigured";
import { Card, PageTitle } from "@/components/ui";
import { knownWallets } from "@/data/wallets";
import { compact } from "@/lib/format";
import { insightDicts } from "@/lib/i18n-insights";
import { getAlerts } from "@/lib/insights";
import { getSettings } from "@/lib/settings";
import { getFlows, statsEnabled } from "@/lib/stats";

export const revalidate = 120;
export const metadata: Metadata = { title: "Foundation radar" };

export default async function Radar({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  const x = insightDicts[lang];
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={x.radar} />
        <NotConfigured t={t} />
      </>
    );
  }
  const found = knownWallets.filter((w) => w.category === "foundation");
  const [rows, flows] = await Promise.all([getAlerts(net, ["foundation"], 100), getFlows(net, found.map((w) => w.address), 30)]);
  const out30 = flows.reduce((s, f) => s + Number(f.outflow), 0);
  const in30 = flows.reduce((s, f) => s + Number(f.inflow), 0);
  const toExch = rows.filter((r) => r.meta?.dest === "exchange" && Date.parse(r.at) > Date.now() - 30 * 86_400_000).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  return (
    <>
      <PageTitle title={x.radar} />
      <p className="muted">{x.radarIntro}</p>
      <div className="stats">
        <div className="stat"><div className="label">{t.sent} · {t.range30d}</div><div className="value"><bdi dir="ltr">{compact(out30, lang)}</bdi> <span className="unit">{native}</span></div></div>
        <div className="stat"><div className="label">{t.received} · {t.range30d}</div><div className="value"><bdi dir="ltr">{compact(in30, lang)}</bdi> <span className="unit">{native}</span></div></div>
        <div className="stat span-mobile"><div className="label">{x.dest.exchange} · {t.range30d}</div><div className={`value ${toExch > 0 ? "down" : ""}`}><bdi dir="ltr">{compact(toExch, lang)}</bdi> <span className="unit">{native}</span></div></div>
      </div>
      <Card>
        <AlertList rows={rows} x={x} lang={lang} native={native} empty={t.noRecords} />
      </Card>
    </>
  );
}
