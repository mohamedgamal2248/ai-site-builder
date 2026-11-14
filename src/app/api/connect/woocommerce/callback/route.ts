import { after } from "next/server";
import { getRepo } from "@/lib/db";
import { json, verifyState } from "@/lib/http";
import { finishWooConnection, registerWooWebhooks } from "@/lib/onboarding";
import { syncStore } from "@/lib/services";

export const dynamic = "force-dynamic";

/** WooCommerce POSTs the new API keys here after the merchant approves. `user_id` carries our signed state. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const state = verifyState(typeof body?.user_id === "string" ? body.user_id : null);
  if (!state?.site) return json({ error: "invalid state" }, 400);
  const consumerKey = String(body?.consumer_key ?? "");
  const consumerSecret = String(body?.consumer_secret ?? "");
  if (!consumerKey.startsWith("ck_") || !consumerSecret.startsWith("cs_")) return json({ error: "missing keys" }, 400);

  const repo = await getRepo();
  const store = await finishWooConnection(repo, state.site, { consumerKey, consumerSecret });
  after(async () => {
    const creds = await repo.getCredentials(store.id);
    if (creds) await registerWooWebhooks(store, creds).catch((e) => console.error("woo webhooks failed", e));
    await syncStore(store, repo).catch((e) => console.error("woo first sync failed", e));
  });
  return json({ ok: true });
}
