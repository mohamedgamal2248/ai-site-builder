import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/Header";
import { getSettings } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSettings();
  return {
    title: { default: `${t.siteName} · ${t.tagline}`, template: `%s · ${t.siteName}` },
    description: t.disclaimer,
    icons: { icon: "/icon.svg" },
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
    <html lang={s.lang} dir={s.lang === "ar" ? "rtl" : "ltr"}>
      <body className={s.net === "testnet" ? "is-testnet" : undefined}>
        <Header s={s} />
        <main className="container main">{children}</main>
        <Footer s={s} />
      </body>
    </html>
  );
}
