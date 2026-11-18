import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer, Header, navGroups } from "@/components/Header";
import { CommandPalette } from "@/components/CommandPalette";
import { EARLY_ERRORS, ErrorReporter } from "@/components/ErrorReporter";
import { InstallPrompt } from "@/components/InstallPrompt";
import { extraDicts } from "@/lib/i18n-extra";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { SwRegister } from "@/components/SwRegister";
import { BottomNav } from "@/components/BottomNav";
import { NavProgress } from "@/components/NavProgress";
import { QueryProvider } from "@/components/QueryProvider";
import { insightDicts } from "@/lib/i18n-insights";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

// Self-hosted at build time: no request to Google from visitors.
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-plex" });
import "./globals.css";

type Params = Promise<{ s: string }>;

/**
 * Nothing is prerendered at build time: each page is rendered on its first visit and then
 * served from the CDN (ISR). Keeps deploys fast and puts no load on Horizon or the database
 * during builds (a slow upstream once made a build-time render time out).
 */
export function generateStaticParams(): { s: string }[] {
  return [];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s0 = await getSettings(params);
  const { t } = s0;
  return {
    title: { default: `${t.siteName} · ${t.tagline}`, template: `%s · ${t.siteName}` },
    description:
      s0.lang === "ar"
        ? "مستكشف بلوكتشين Pi بالعربي: سعر Pi لحظة بلحظة، آخر البلوكات والمعاملات، تحركات الحيتان والفاونديشن والمنصات، ومؤشر ضغط Pi."
        : "Pi Network blockchain explorer: live Pi price, blocks and transactions, whale, Foundation and exchange movements, and the Pi Pressure Index.",
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
    metadataBase: new URL(process.env.SITE_URL || "https://blockchainpi.vercel.app"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#120f1d" },
  ],
};

// Vercel Web Analytics (cookie-free page views and countries), loaded straight from Vercel's
// own path on this domain. Only on Vercel, so local runs and tests are not counted.
const ANALYTICS = process.env.VERCEL ? "window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments)};" : "";

const SITE = process.env.SITE_URL || "https://blockchainpi.vercel.app";
/** Site-wide structured data: lets Google show the site name and a search box for it. */
const siteJsonLd = (lang: "ar" | "en") => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Blockchain Pi",
      url: SITE,
      inLanguage: lang,
      potentialAction: { "@type": "SearchAction", target: `${SITE}/search?q={query}`, "query-input": "required name=query" },
    },
    { "@type": "Organization", name: "Blockchain Pi", url: SITE, logo: `${SITE}/icons/icon-512.png` },
  ],
});

// Applies the saved theme before the first paint (the page itself is the same for everyone).
const THEME_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}`;

export default async function RootLayout({ children, params }: { children: ReactNode; params: Params }) {
  // Only the middleware's segments are real pages; anything else (e.g. /missing.png) is a 404.
  if (!/^(ar|en)-(main|test)(~|%7E|$)/i.test((await params).s)) notFound();
  const s = await getSettings(params);
  return (
    <html lang={s.lang} dir={s.lang === "ar" ? "rtl" : "ltr"} className={plex.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_ERRORS + THEME_SCRIPT + ANALYTICS }} />
        {ANALYTICS ? <script defer src="/_vercel/insights/script.js" /> : null}
        {/* Vercel Speed Insights: real visitors' load times (Core Web Vitals) per page. */}
        {ANALYTICS ? <script defer src="/_vercel/speed-insights/script.js" /> : null}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(s.lang)) }} />
      </head>
      <body className={s.net === "testnet" ? "is-testnet" : undefined}>
        <a className="skip-link" href="#main">{s.lang === "ar" ? "اتنقل للمحتوى" : "Skip to content"}</a>
        <NavProgress />
        <QueryProvider>
          <Header s={s} />
          <main id="main" tabIndex={-1} className="container main">{children}</main>
        </QueryProvider>
        <Footer s={s} />
        <BottomNav labels={{ home: s.t.home, index: insightDicts[s.lang].indexShort, watch: s.lang === "ar" ? "متابعاتي" : "Watching", unlocks: s.lang === "ar" ? "فك القفل" : "Unlocks", menu: s.t.menu }} />
        <SwRegister />
        <ErrorReporter />
        <InstallPrompt labels={extraDicts[s.lang].install} />
        <CommandPalette labels={extraDicts[s.lang].cmdk} lang={s.lang} pages={[["/", s.t.home], ...navGroups(s).flatMap((g) => g.items)]} />
      </body>
    </html>
  );
}
