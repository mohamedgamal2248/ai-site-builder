import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { Card, PageTitle } from "@/components/ui";
import { WatchlistView } from "@/components/WatchlistView";
import { getSettings } from "@/lib/settings";
import { NotifyButton } from "@/components/NotifyButton";
import { WatchTransfer } from "@/components/WatchTransfer";

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
      <Card>
        <WatchTransfer
          net={net}
          labels={
            lang === "ar"
              ? { title: "انقل قائمتك لجهاز تاني", intro: "من غير حساب: امسح الكود بموبايلك أو ابعت الرابط لنفسك. المحافظ والأسماء الخاصة بتتنقل جوه الرابط نفسه، ومش بتتبعت لسيرفرنا.", show: "اعرض كود النقل", hide: "اخفي الكود", copy: "انسخ الرابط", copied: "اتنسخ ✓", paste: "رابط أو كود نقل", pasteHint: "الصق رابط النقل هنا", import: "استورد", confirm: "تضيف {n} محفظة (والأسماء الخاصة) لقائمتك على الجهاز ده؟", done: "اتضاف {n} محفظة جديدة ✓", bad: "الرابط ده مش رابط نقل صحيح.", empty: "قائمتك فاضية، مفيش حاجة تتنقل." }
              : { title: "Move your list to another device", intro: "No account needed: scan the code with your phone or send yourself the link. Wallets and private names travel inside the link itself and never reach our server.", show: "Show transfer code", hide: "Hide code", copy: "Copy link", copied: "Copied ✓", paste: "Transfer link or code", pasteHint: "Paste a transfer link here", import: "Import", confirm: "Add {n} wallets (and private names) to your list on this device?", done: "{n} new wallets added ✓", bad: "That isn't a valid transfer link.", empty: "Your list is empty; there's nothing to move." }
          }
        />
      </Card>
    </>
  );
}
