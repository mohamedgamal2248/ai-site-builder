import type { Metadata } from "next";
import { Card, PageTitle } from "@/components/ui";
import { WatchlistView } from "@/components/WatchlistView";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Watchlist" };

export default async function Watchlist() {
  const { t, lang, native, net } = await getSettings();
  return (
    <>
      <PageTitle title={t.watchlist} />
      <p className="muted">{t.watchlistIntro}</p>
      <Card>
        <WatchlistView t={t} lang={lang} native={native} net={net} />
      </Card>
    </>
  );
}
