import type { Metadata } from "next";
import { parseSegment } from "./settings";

/** Localised titles and search descriptions for each page (Arabic is the site's main language). */
const PAGES: Record<string, { ar: [string, string]; en: [string, string] }> = {
  Blocks: { ar: ["بلوكات شبكة Pi", "آخر البلوكات على بلوكتشين Pi لحظة بلحظة: رقم البلوك وعدد المعاملات والعمليات ووقت الإغلاق."], en: ["Pi Network blocks", "The latest blocks on the Pi blockchain in real time: number, transactions, operations and close time."] },
  Transactions: { ar: ["معاملات شبكة Pi", "آخر معاملات بلوكتشين Pi: الهاش والمرسل والرسوم والحالة، مع رابط لكل معاملة."], en: ["Pi Network transactions", "The latest Pi blockchain transactions: hash, sender, fee and status."] },
  Operations: { ar: ["عمليات شبكة Pi", "كل العمليات على بلوكتشين Pi: تحويلات وقفل وفك قفل وفتح حسابات."], en: ["Pi Network operations", "Every operation on the Pi blockchain: payments, lockups, claims and new accounts."] },
  Statistics: { ar: ["إحصائيات شبكة Pi", "إحصائيات يومية لشبكة Pi: المعاملات وحجم التحويلات والحسابات الجديدة والقفل، لـ 30 و90 يوم وسنة."], en: ["Pi Network statistics", "Daily Pi Network statistics: transactions, payment volume, new accounts and lockups."] },
  "Exchange flows": { ar: ["تدفقات Pi للمنصات", "كمية Pi اللي بتدخل وتخرج من محافظ OKX وBitget كل يوم، وصافي الضغط على السعر."], en: ["Pi exchange flows", "Pi moving into and out of OKX and Bitget wallets every day, and the net pressure."] },
  "Whale alerts": { ar: ["تنبيهات حيتان Pi", "أكبر تحويلات Pi لحظة بلحظة، مع أسماء المنصات والمحافظ المعروفة."], en: ["Pi whale alerts", "The largest Pi transfers as they happen, with exchange and known-wallet names."] },
  Supply: { ar: ["المعروض من Pi", "إجمالي Pi والمعروض المتداول والمقفول، ورصيد محافظ الفاونديشن."], en: ["Pi supply", "Total, circulating and locked Pi, and the Foundation wallets' balances."] },
  "Unlock schedule": { ar: ["جدول فك قفل Pi", "Pi اللي هيتفك قفله كل يوم وكل شهر، وأكبر الحسابات المقفولة."], en: ["Pi unlock schedule", "How much Pi unlocks each day and month, and the biggest locked accounts."] },
  "Largest transfers": { ar: ["أكبر تحويلات Pi", "أكبر تحويلات Pi خلال 24 ساعة و7 أيام و30 يوم."], en: ["Largest Pi transfers", "The largest Pi transfers in the last 24 hours, 7 and 30 days."] },
  "Locked Pi": { ar: ["Pi المقفول", "كل أرصدة Pi المقفولة على البلوكتشين ومواعيد فكها."], en: ["Locked Pi", "Every locked Pi balance on the blockchain and when it unlocks."] },
  Assets: { ar: ["العملات على شبكة Pi", "التوكنات المصدرة على بلوكتشين Pi وعدد حامليها."], en: ["Assets on Pi Network", "Tokens issued on the Pi blockchain and their holders."] },
  "Liquidity pools": { ar: ["مجمّعات السيولة على Pi", "مجمّعات السيولة على بلوكتشين Pi واحتياطياتها."], en: ["Pi liquidity pools", "Liquidity pools on the Pi blockchain and their reserves."] },
  Trades: { ar: ["تداولات شبكة Pi", "آخر التداولات على البورصة اللامركزية في شبكة Pi."], en: ["Pi Network trades", "The latest trades on Pi's decentralized exchange."] },
  "Known wallets": { ar: ["محافظ Pi المعروفة", "محافظ الفاونديشن والمنصات والحيتان على شبكة Pi، بمصادرها وأرصدتها."], en: ["Known Pi wallets", "Foundation, exchange and whale wallets on Pi Network, with sources and balances."] },
  "Top holders": { ar: ["أكبر حاملي Pi", "قائمة أكبر حسابات Pi حسب الرصيد."], en: ["Top Pi holders", "The largest Pi accounts by balance."] },
  Watchlist: { ar: ["قائمة المتابعة", "تابع محافظ Pi وخلي التنبيهات توصلك على الموبايل."], en: ["Watchlist", "Follow Pi wallets and get notified on your phone."] },
  API: { ar: ["API بيانات Pi", "واجهة JSON مجانية لبيانات بلوكتشين Pi والإحصائيات."], en: ["Pi data API", "A free JSON API for Pi blockchain data and statistics."] },
  Status: { ar: ["حالة الخدمة", "حالة Pi Horizon وقاعدة البيانات والمُفهرس."], en: ["Service status", "Status of Pi Horizon, the database and the indexer."] },
  "Pi Pressure Index": { ar: ["مؤشر ضغط Pi", "مؤشر من 0 لـ 100 بيجمع تدفقات المنصات والفاونديشن والحيتان وفك القفل ودفاتر الأوامر. مش نصيحة استثمار."], en: ["Pi Pressure Index", "A 0–100 index combining exchange flows, Foundation moves, whales, unlocks and order books. Not investment advice."] },
  "Index track record": { ar: ["دقة مؤشر ضغط Pi", "سجل توقعات مؤشر الضغط مقارنة بحركة السعر الفعلية."], en: ["Pressure index track record", "How the pressure index's calls compared with actual price moves."] },
  Alerts: { ar: ["تنبيهات Pi", "تنبيهات حركة الفاونديشن والدخول غير العادي للمنصات، وتنبيهات السعر على موبايلك."], en: ["Pi alerts", "Foundation moves, unusual exchange inflows and price alerts on your phone."] },
  "Foundation radar": { ar: ["رادار فاونديشن Pi", "كل تحويل كبير من محافظ فاونديشن Pi والكور تيم ورايح فين."], en: ["Pi Foundation radar", "Every large transfer out of the Pi Foundation and Core Team wallets, and where it went."] },
  "Whale tracker": { ar: ["متتبع حيتان Pi", "إجمالي رصيد أكبر 100 حامل لـ Pi: بيجمّعوا ولا بيوزّعوا؟"], en: ["Pi whale tracker", "Total balance of the 100 largest Pi holders: accumulating or distributing?"] },
  "Market depth": { ar: ["عمق سوق Pi", "دفاتر أوامر PI/USDT على OKX وBitget وجدران الشراء والبيع."], en: ["Pi market depth", "PI/USDT order books on OKX and Bitget, with buy and sell walls."] },
  "Pi daily report": { ar: ["تقرير Pi اليومي", "ملخص يوم كامل على بلوكتشين Pi: السعر والمؤشر وتدفقات المنصات وأكبر التحويلات."], en: ["Pi daily report", "A full day on the Pi blockchain: price, index, exchange flows and the largest transfers."] },
  "Pi weekly report": { ar: ["تقرير Pi الأسبوعي", "ملخص أسبوع على بلوكتشين Pi مقارنة بالأسبوع اللي قبله."], en: ["Pi weekly report", "The week on the Pi blockchain compared with the week before."] },
  "Pi news": { ar: ["أخبار Pi Network", "آخر أخبار Pi Network من المدونة الرسمية ومواقع الأخبار، مع أحداث البلوكتشين."], en: ["Pi Network news", "The latest Pi Network news from the official blog and news sites, with on-chain events."] },
  "Network growth": { ar: ["نمو شبكة Pi", "الحسابات الجديدة والنشاط ونسبة نجاح المعاملات على شبكة Pi."], en: ["Pi Network growth", "New accounts, activity and transaction success on Pi Network."] },
  Widget: { ar: ["ودجت سعر Pi", "اعرض سعر Pi ومؤشر الضغط مباشرة في موقعك."], en: ["Pi price widget", "Show the live Pi price and pressure index on your website."] },
  Guides: { ar: ["تعلّم بلوكتشين Pi", "شروحات بسيطة: يعني إيه بلوك، وإزاي تقرا معاملة، والقفل، ومؤشر الضغط."], en: ["Learn the Pi blockchain", "Simple guides: what a block is, how to read a transaction, lockups and the pressure index."] },
};

export async function pageMeta(params: Promise<{ s: string }> | { s: string }, key: string, path?: string): Promise<Metadata> {
  const { lang } = parseSegment((await params).s);
  const m = PAGES[key]?.[lang];
  if (!m) return { title: key };
  return {
    title: m[0],
    description: m[1],
    openGraph: { title: m[0], description: m[1], locale: lang === "ar" ? "ar_EG" : "en_US", type: "website" },
    ...(path ? { alternates: { canonical: path } } : {}),
  };
}
