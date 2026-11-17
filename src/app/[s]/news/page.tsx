import { Ago } from "@/components/Ago";
import type { Metadata } from "next";
import { AlertList } from "@/components/AlertList";
import { Card, PageTitle } from "@/components/ui";
import { formatDate, timeAgo } from "@/lib/format";
import { insightDicts } from "@/lib/i18n-insights";
import { getAlerts, getNews } from "@/lib/insights";
import { getSettings } from "@/lib/settings";
import { statsEnabled } from "@/lib/stats";

export const revalidate = 1800;
export const metadata: Metadata = { title: "Pi news" };

export default async function News({ params }: { params: Promise<{ s: string }> }) {
  const { t, net, lang, native } = await getSettings(params);
  const x = insightDicts[lang];
  const [news, events] = await Promise.all([getNews(40), statsEnabled() ? getAlerts(net, ["foundation", "inflow_spike"], 8) : Promise.resolve([])]);
  const now = Date.now();
  return (
    <>
      <PageTitle title={x.news} />
      <p className="muted">{x.newsIntro}</p>
      {events.length ? (
        <Card title={x.chainEvents}>
          <AlertList rows={events} x={x} lang={lang} native={native} empty={t.noRecords} />
        </Card>
      ) : null}
      <Card>
        {news.length === 0 ? (
          <p className="muted">{x.noNews}</p>
        ) : (
          <ul className="news">
            {news.map((n) => (
              <li key={n.link}>
                <a href={n.link} target="_blank" rel="noopener noreferrer nofollow">{n.title}</a>
                <div className="muted">
                  {n.source.includes("official") ? <span className="badge ok">{x.official}</span> : n.source}
                  {n.at ? <> · <Ago iso={n.at} lang={lang} title={formatDate(n.at, lang)} /></> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
