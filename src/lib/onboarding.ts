import { randomBytes } from "node:crypto";
import type { FetchLike } from "./connectors";
import { absoluteUrl, getJson, obj, str } from "./connectors/util";
import { ZID_API, zidHeaders, zidWebhookToken } from "./connectors/zid";
import type { Repository } from "./db";
import { env } from "./env";
import type { Store, StoreCredentials } from "./types";

export const WOO_WEBHOOK_TOPICS = ["order.created", "product.created", "product.updated", "product.deleted"];
export const ZID_WEBHOOK_EVENTS = ["order.create", "product.create", "product.update", "product.publish", "product.delete"];

export function normalizeSite(input: string): string | null {
  try {
    const u = new URL(input.includes("://") ? input : `https://${input}`);
    if (u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** WooCommerce's built-in key-issuing flow: the merchant approves, Woo POSTs keys to our callback. */
export function wooAuthorizeUrl(site: string, state: string): string {
  const u = new URL(absoluteUrl(site, "wc-auth/v1/authorize"));
  u.searchParams.set("app_name", "Wasl");
  u.searchParams.set("scope", "read_write");
  u.searchParams.set("user_id", state);
  u.searchParams.set("return_url", `${env.appUrl}/connected?platform=woocommerce`);
  u.searchParams.set("callback_url", `${env.appUrl}/api/connect/woocommerce/callback`);
  return u.toString();
}

export async function finishWooConnection(repo: Repository, site: string, keys: { consumerKey: string; consumerSecret: string }, fetchImpl: FetchLike = fetch): Promise<Store> {
  const auth = { Authorization: `Basic ${Buffer.from(`${keys.consumerKey}:${keys.consumerSecret}`).toString("base64")}` };
  let currency = "USD";
  let name = new URL(site).host;
  try {
    currency = str(obj(await getJson(fetchImpl, absoluteUrl(site, "wp-json/wc/v3/data/currencies/current"), auth)).code) || currency;
  } catch (e) {
    console.warn("woo currency lookup failed", e);
  }
  try {
    name = str(obj(await getJson(fetchImpl, absoluteUrl(site, "wp-json"), {})).name) || name;
  } catch {
    /* site name is cosmetic */
  }

  const store = await repo.upsertStore({ platform: "woocommerce", externalId: site, name, domain: site, currency, shipsTo: [], status: "active", plan: "free" });
  const creds: StoreCredentials = { ...keys, webhookSecret: randomBytes(24).toString("base64url") };
  await repo.saveCredentials(store.id, creds);
  return store;
}

export async function registerWooWebhooks(store: Store, creds: StoreCredentials, fetchImpl: FetchLike = fetch): Promise<number> {
  const auth = `Basic ${Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64")}`;
  let created = 0;
  for (const topic of WOO_WEBHOOK_TOPICS) {
    const res = await fetchImpl(absoluteUrl(store.domain, "wp-json/wc/v3/webhooks"), {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Wasl ${topic}`, topic, delivery_url: `${env.appUrl}/api/webhooks/woocommerce`, secret: creds.webhookSecret, status: "active" }),
    });
    if (res.ok) created++;
    else console.warn("woo webhook create failed", topic, res.status);
  }
  return created;
}

/** After the Zid OAuth exchange: read the store profile, save it, then subscribe to webhooks. */
export async function finishZidConnection(repo: Repository, creds: StoreCredentials, fetchImpl: FetchLike = fetch): Promise<Store> {
  const profile = obj(await getJson(fetchImpl, `${ZID_API}/managers/account/profile`, zidHeaders(creds)));
  const storeInfo = obj(obj(profile.user).store);
  const externalId = str(storeInfo.id);
  if (!externalId) throw new Error("Zid profile did not include a store id");
  const domain = (str(storeInfo.url) || str(storeInfo.domain)).replace(/\/$/, "");
  const store = await repo.upsertStore({
    platform: "zid",
    externalId,
    name: str(storeInfo.title) || str(storeInfo.name) || `Zid store ${externalId}`,
    domain: domain.startsWith("http") ? domain : `https://${domain}`,
    currency: str(obj(storeInfo.currency).code) || str(storeInfo.currency) || "SAR",
    shipsTo: ["SA"],
    status: "active",
    plan: "free",
  });
  await repo.saveCredentials(store.id, creds);
  return store;
}

export async function registerZidWebhooks(store: Store, creds: StoreCredentials, fetchImpl: FetchLike = fetch): Promise<number> {
  const secret = env.zidWebhookSecret;
  if (!secret) throw new Error("ZID_WEBHOOK_SECRET is not set");
  let created = 0;
  for (const event of ZID_WEBHOOK_EVENTS) {
    const target = new URL(`${env.appUrl}/api/webhooks/zid`);
    target.searchParams.set("store", store.externalId);
    target.searchParams.set("event", event);
    target.searchParams.set("token", zidWebhookToken(secret, store.externalId, event));
    // Field names follow Zid's "Create a Webhook" reference; verify against a live call.
    const res = await fetchImpl(`${ZID_API}/managers/webhooks`, {
      method: "POST",
      headers: { ...zidHeaders(creds, store.externalId), "Content-Type": "application/json" },
      body: JSON.stringify({ event, target_url: target.toString(), original_id: `wasl-${event}`, subscriber: "Wasl" }),
    });
    if (res.ok) created++;
    else console.warn("zid webhook create failed", event, res.status);
  }
  return created;
}

