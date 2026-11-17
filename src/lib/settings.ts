import { cookies } from "next/headers";
import { dictionaries, type Lang } from "./i18n";
import type { Network } from "./horizon";

export type Theme = "auto" | "light" | "dark";

export async function getSettings() {
  const c = await cookies();
  const lang: Lang = c.get("lang")?.value === "en" ? "en" : "ar";
  const net: Network = c.get("net")?.value === "testnet" ? "testnet" : "mainnet";
  const themeRaw = c.get("theme")?.value;
  const theme: Theme = themeRaw === "light" || themeRaw === "dark" ? themeRaw : "auto";
  const t = dictionaries[lang];
  return { lang, net, theme, t, native: net === "testnet" ? "Test-Pi" : "Pi" };
}

export type Settings = Awaited<ReturnType<typeof getSettings>>;
