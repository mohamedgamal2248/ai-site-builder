import type { Metadata } from "next";
import { Card, DataTable, PageTitle } from "@/components/ui";
import { healthChecks, type Check } from "@/lib/health";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status" };

export default async function Status() {
  const { t, net } = await getSettings();
  const checks = await healthChecks(net);
  const label = { ok: t.ok, degraded: t.degraded, down: t.down };
  const cls = { ok: "ok", degraded: "neutral", down: "bad" };
  return (
    <>
      <PageTitle title={t.status} />
      <p className="muted">{t.statusIntro}</p>
      <Card>
        <DataTable<Check>
          rows={checks}
          rowKey={(c) => c.name}
          empty={t.noRecords}
          columns={[
            { label: t.component, cell: (c) => <strong dir="ltr">{c.name}</strong> },
            { label: t.state, cell: (c) => <span className={`badge ${cls[c.state]}`}>{label[c.state]}</span> },
            { label: t.latency, cell: (c) => (c.ms !== undefined ? <bdi dir="ltr">{c.ms} ms</bdi> : "—"), className: "num" },
            { label: t.details, cell: (c) => <bdi dir="ltr" className="muted">{c.detail ?? ""}</bdi> },
          ]}
        />
      </Card>
    </>
  );
}
