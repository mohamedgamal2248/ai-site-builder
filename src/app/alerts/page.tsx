import type { Metadata } from "next";
import { AlertList } from "@/components/AlertList";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NotConfigured } from "@/components/NotConfigured";
import { RulesForm } from "@/components/RulesForm";
import { Card, PageTitle } from "@/components/ui";
import { insightDicts } from "@/lib/i18n-insights";
import { getAlerts } from "@/lib/insights";
import { getSettings } from "@/lib/settings";
import { statsEnabled } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alerts" };

export default async function Alerts() {
  const { t, net, lang, native } = await getSettings();
  const x = insightDicts[lang];
  if (!statsEnabled()) {
    return (
      <>
        <PageTitle title={x.alertsTitle} />
        <NotConfigured t={t} />
      </>
    );
  }
  const rows = await getAlerts(net, ["foundation", "inflow_spike"], 50);
  return (
    <>
      <AutoRefresh seconds={60} />
      <PageTitle title={x.alertsTitle} />
      <p className="muted">{x.alertsIntro}</p>
      <Card title={x.myAlerts}>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{x.myAlertsIntro}</p>
        <RulesForm net={net} labels={{ ruleTypes: x.ruleTypes, save: x.save, saved: x.saved, enableFirst: x.enableFirst, unsupported: x.unsupported, notify: t.notify }} />
      </Card>
      <Card title={x.recent}>
        <AlertList rows={rows} x={x} lang={lang} native={native} empty={t.noRecords} />
      </Card>
    </>
  );
}
