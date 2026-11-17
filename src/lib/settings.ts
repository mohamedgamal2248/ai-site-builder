import { cookies } from "next/headers";
import { dictionaries, type Lang } from "./i18n";
import type { Network } from "./horizon";

export async function getSettings() {
  const c = await cookies();
  const lang: Lang = c.get("lang")?.value === "en" ? "en" : "ar";
  const net: Network = c.get("net")?.value === "testnet" ? "testnet" : "mainnet";
  const t = dictionaries[lang];
  return { lang, net, t, native: net === "testnet" ? "Test-Pi" : "Pi" };
}

export type Settings = Awaited<ReturnType<typeof getSettings>>;
