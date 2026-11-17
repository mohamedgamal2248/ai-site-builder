import type { Metadata } from "next";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Card, DataTable, PageTitle } from "@/components/ui";
import { compact } from "@/lib/format";
import { insightDicts } from "@/lib/i18n-insights";
import { depthOf, getBooks, type Depth } from "@/lib/market";
import { getSettings } from "@/lib/settings";

export const revalidate = 60;
export const metadata: Metadata = { title: "Market depth" };

export default async function DepthPage({ params }: { params: Promise<{ s: string }> }) {
  const { t, lang } = await getSettings(params);
  const x = insightDicts[lang];
  // One upstream call per exchange per minute, shared by all visitors.
  const depths = (await getBooks(60)).map((b) => depthOf(b, [1, 2, 5]));
  const fmtP = (p: number) => `$${p.toFixed(4)}`;

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageTitle title={x.depth} sub="PI/USDT" />
      <p className="muted">{x.depthIntro}</p>
      {depths.length === 0 ? <p className="notice">{t.noRecords}</p> : null}
      {depths.map((d: Depth) => (
        <Card key={d.exchange} title={<>{d.exchange} · <bdi dir="ltr">{fmtP(d.mid)}</bdi></>}>
          <DataTable
            rows={d.bands}
            rowKey={(b) => String(b.pct)}
            empty={t.noRecords}
            columns={[
              { label: "", cell: (b) => <strong>{x.within.replace("{p}", String(b.pct))}</strong> },
              { label: x.bids, cell: (b) => <span className="up"><bdi dir="ltr">{compact(b.bid, lang)}</bdi></span>, className: "num" },
              { label: x.asks, cell: (b) => <span className="down"><bdi dir="ltr">{compact(b.ask, lang)}</bdi></span>, className: "num" },
              {
                label: "",
                cell: (b) => (
                  <div className="depth-bar" aria-hidden="true">
                    <span className="bid" style={{ width: `${(b.bid / (b.bid + b.ask || 1)) * 100}%` }} />
                  </div>
                ),
              },
            ]}
          />
          <div className="stats" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="stat"><div className="label">{x.bidWall}</div><div className="value up">{d.bidWall ? <><bdi dir="ltr">{compact(d.bidWall.size, lang)}</bdi> <span className="unit">{x.at} <bdi dir="ltr">{fmtP(d.bidWall.price)}</bdi></span></> : "—"}</div></div>
            <div className="stat"><div className="label">{x.askWall}</div><div className="value down">{d.askWall ? <><bdi dir="ltr">{compact(d.askWall.size, lang)}</bdi> <span className="unit">{x.at} <bdi dir="ltr">{fmtP(d.askWall.price)}</bdi></span></> : "—"}</div></div>
          </div>
        </Card>
      ))}
    </>
  );
}
