import { after } from "next/server";
import { getRepo } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { parseZidWebhook, verifyZidWebhook } from "@/lib/connectors/zid";
import { handleWebhookEvent, syncStore } from "@/lib/services";

export const dynamic = "force-dynamic";

/** Zid webhook target: /api/webhooks/zid?store=<id>&event=<event>&token=<hmac> (we create these at install). */
export async function POST(req: Request) {
  const params = new URL(req.url).searchParams;
  if (!verifyZidWebhook(params, env.zidWebhookSecret)) return json({ error: "invalid token" }, 401);
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "invalid json" }, 400);

  const storeId = params.get("store")!;
  const ev = parseZidWebhook(params.get("event")!, storeId, body);
  const repo = await getRepo();
  const result = await handleWebhookEvent("zid", ev, repo);
  if ("resync" in result && result.resync) {
    const store = await repo.findStore("zid", storeId);
    if (store) after(() => syncStore(store).catch((e) => console.error("zid sync failed", e)));
  }
  return json(result);
}
