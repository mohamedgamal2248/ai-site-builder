import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/Header";
import { BASE_SEGMENTS, getSettings } from "@/lib/settings";
import { SwRegister } from "@/components/SwRegister";
import { BottomNav } from "@/components/BottomNav";
import { NavProgress } from "@/components/NavProgress";
import { insightDicts } from "@/lib/i18n-insights";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

// Self-hosted at build time: no request to Google from visitors.
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-plex" });
import "./globals.css";

type Params = Promise<{ s: string }>;

/** The four language/network shells are built ahead of time; query variants on first visit. */
export function generateStaticParams() {
  return BASE_SEGMENTS.map((s) => ({ s }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { t } = await getSettings(params);
  return {
    title: { default: `${t.siteName} · ${t.tagline}`, template: `%s · ${t.siteName}` },
    description: t.disclaimer,
    icons: { icon: "/icon.svg", apple: "/icons/icon-192.png" },
    metadataBase: new URL(process.env.SITE_URL || "https://ai-site-builder-peach.vercel.app"),
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

// Applies the saved theme before the first paint (the page itself is the same for everyone).
const THEME_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}`;

export default async function RootLayout({ children, params }: { children: ReactNode; params: Params }) {
  const s = await getSettings(params);
  return (
    <html lang={s.lang} dir={s.lang === "ar" ? "rtl" : "ltr"} className={plex.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={s.net === "testnet" ? "is-testnet" : undefined}>
        <NavProgress />
        <Header s={s} />
        <main className="container main">{children}</main>
        <Footer s={s} />
        <BottomNav labels={{ home: s.t.home, index: insightDicts[s.lang].indexShort, search: s.t.search, alerts: insightDicts[s.lang].alerts, menu: s.t.menu }} />
        <SwRegister />
      </body>
    </html>
  );
}
