import { after } from "next/server";
import { getRepo } from "@/lib/db";
import { json } from "@/lib/http";
import { parseWooWebhook, verifyWooWebhook } from "@/lib/connectors/woocommerce";
import { handleWebhookEvent, syncStore } from "@/lib/services";

export const dynamic = "force-dynamic";

function siteKey(source: string): string {
  try {
    const u = new URL(source);
    return `${u.protocol}//${u.host}`;
  } catch {
    return source.replace(/\/$/, "");
  }
}

/** WooCommerce webhooks, created automatically when a store connects. */
export async function POST(req: Request) {
  const raw = await req.text();
  const source = siteKey(req.headers.get("x-wc-webhook-source") ?? "");
  const topic = req.headers.get("x-wc-webhook-topic") ?? "";
  const repo = await getRepo();
  const store = source ? await repo.findStore("woocommerce", source) : null;
  // Woo sends a ping ("webhook_id=...") when a webhook is created; accept it once we know the store.
  if (!topic && store) return json({ ok: true });
  if (!store) return json({ error: "unknown store" }, 404);

  const creds = await repo.getCredentials(store.id);
  if (!verifyWooWebhook(raw, req.headers.get("x-wc-webhook-signature"), creds?.webhookSecret)) return json({ error: "invalid signature" }, 401);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const result = await handleWebhookEvent("woocommerce", parseWooWebhook(topic, source, body), repo);
  if ("resync" in result && result.resync) after(() => syncStore(store).catch((e) => console.error("woo sync failed", e)));
  return json(result);
}
