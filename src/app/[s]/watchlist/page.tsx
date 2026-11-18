import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { Card, PageTitle } from "@/components/ui";
import { WatchlistView } from "@/components/WatchlistView";
import { getSettings } from "@/lib/settings";
import { NotifyButton } from "@/components/NotifyButton";

export const revalidate = 86400;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Watchlist", "/watchlist");
}

export default async function Watchlist({ params }: { params: Promise<{ s: string }> }) {
  const { t, lang, native, net } = await getSettings(params);
  return (
    <>
      <PageTitle title={t.watchlist} />
      <p className="muted">{t.watchlistIntro}</p>
      <p><NotifyButton net={net} labels={{ notify: t.notify, on: t.notifyOn, blocked: t.notifyBlocked }} /></p>
      <Card>
        <WatchlistView t={t} lang={lang} native={native} net={net} />
      </Card>
    </>
  );
}
