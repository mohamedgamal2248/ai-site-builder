import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/Header";
import { getSettings } from "@/lib/settings";
import { SwRegister } from "@/components/SwRegister";
import { BottomNav } from "@/components/BottomNav";
import { NavProgress } from "@/components/NavProgress";
import { insightDicts } from "@/lib/i18n-insights";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

// Self-hosted at build time: no request to Google from visitors.
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-plex" });
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSettings();
  return {
    title: { default: `${t.siteName} · ${t.tagline}`, template: `%s · ${t.siteName}` },
    description: t.disclaimer,
    icons: { icon: "/icon.svg", apple: "/icons/icon-192.png" },
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await getSettings();
  return (
    <html lang={s.lang} dir={s.lang === "ar" ? "rtl" : "ltr"} data-theme={s.theme === "auto" ? undefined : s.theme} className={plex.variable}>
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
