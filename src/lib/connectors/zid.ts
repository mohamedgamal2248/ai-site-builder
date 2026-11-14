/**
 * Zid connector.
 * Docs: https://docs.zid.sa  (API base https://api.zid.sa/v1, OAuth https://oauth.zid.sa)
 * - Every call sends `Authorization: Bearer <authorization>` AND `X-Manager-Token: <access_token>`.
 * - Webhooks are created per event with POST /v1/managers/webhooks and a target URL. Zid's delivery
 *   signature is not documented clearly, so each target URL carries our own HMAC token
 *   (`?store=<id>&event=<name>&token=<hmac>`), which we verify on receipt.
 * - No documented cart-prefill URL, so links land on the product page.
 */
import { hmacSha256, safeEqual } from "../crypto";
import type { NewProduct, Product, Store, StoreCredentials } from "../types";
import type { CartTarget, Connector, FetchLike, WebhookEvent } from "./types";
import { absoluteUrl, arr, getJson, num, obj, str, stripHtml } from "./util";

export const ZID_API = "https://api.zid.sa/v1";
export const ZID_OAUTH = "https://oauth.zid.sa";

export function zidHeaders(creds: StoreCredentials, storeExternalId?: string): Record<string, string> {
  if (!creds.accessToken || !creds.managerToken) throw new Error("Zid store is missing tokens");
  return {
    Authorization: `Bearer ${creds.accessToken}`,
    "X-Manager-Token": creds.managerToken,
    "Accept-Language": "ar",
    ...(storeExternalId ? { "Store-Id": storeExternalId } : {}),
  };
}

export function mapZidProduct(raw: unknown, store: Store): NewProduct | null {
  const p = obj(raw);
  if (p.is_published === false) return null;
  const externalId = str(p.id);
  if (!externalId) return null;
  const slug = str(p.slug);
  const url = str(p.html_url) || str(p.url) || (slug ? absoluteUrl(store.domain, `products/${slug}`) : "");
  if (!url) return null;

  const price = num(p.price) ?? 0;
  const salePrice = num(p.sale_price);
  const quantity = num(p.quantity);
  const infinite = p.is_infinite === true;
  const images = arr(p.images).map(obj);
  const firstImage = obj(images[0]?.image);

  return {
    storeId: store.id,
    externalId,
    title: str(p.name),
    description: stripHtml(str(p.description) || str(p.short_description)).slice(0, 5000),
    brand: str(obj(p.brand).name) || null,
    url,
    imageUrl: str(firstImage.full_size) || str(firstImage.large) || str(images[0]?.url) || null,
    price,
    salePrice: salePrice && salePrice > 0 && salePrice < price ? salePrice : null,
    currency: str(p.currency) || store.currency,
    availability: !infinite && quantity !== null && quantity <= 0 ? "out_of_stock" : "in_stock",
    quantity: infinite ? null : quantity,
    sku: str(p.sku) || null,
    category: str(obj(arr(p.categories)[0]).name) || null,
    attributes: {},
    variants: [],
  };
}

export const zidConnector: Connector = {
  platform: "zid",

  async *fetchProducts(store: Store, creds: StoreCredentials, fetchImpl: FetchLike = fetch) {
    const headers = zidHeaders(creds, store.externalId);
    let url: string | null = `${ZID_API}/products/?page=1&page_size=50`;
    for (let guard = 0; url && guard < 500; guard++) {
      const body = obj(await getJson(fetchImpl, url, headers));
      const results = arr(body.results);
      yield results.map((r) => mapZidProduct(r, store)).filter((p): p is NewProduct => p !== null);
      const next = str(body.next);
      url = next && results.length > 0 ? next : null;
    }
  },

  cartTarget(_store: Store, product: Product): CartTarget {
    return { url: product.url, kind: "product_page" };
  },
};

/** The token we put in each Zid webhook target URL. */
export function zidWebhookToken(secret: string, storeExternalId: string, event: string): string {
  return hmacSha256(secret, `${storeExternalId}:${event}`, "base64url").slice(0, 32);
}

export function verifyZidWebhook(params: URLSearchParams, secret: string | undefined): boolean {
  const store = params.get("store");
  const event = params.get("event");
  const token = params.get("token");
  if (!secret || !store || !event || !token) return false;
  return safeEqual(token, zidWebhookToken(secret, store, event));
}

export function parseZidWebhook(event: string, storeExternalId: string, body: unknown): WebhookEvent {
  const d = obj(body);
  switch (event) {
    case "product.create":
    case "product.update":
    case "product.publish":
      return { type: "product_changed", storeExternalId, productExternalId: str(d.id) };
    case "product.delete":
      return { type: "product_deleted", storeExternalId, productExternalId: str(d.id) };
    case "order.create":
      return {
        type: "order",
        storeExternalId,
        order: {
          externalOrderId: str(d.id) || str(d.code),
          total: num(d.order_total) ?? num(d.total) ?? 0,
          currency: str(d.currency_code) || str(obj(d.currency).code) || "SAR",
          status: str(obj(d.order_status).code) || str(d.order_status) || "new",
          productExternalIds: arr(d.products).map((i) => str(obj(i).id) || str(obj(i).product_id)).filter(Boolean),
          ref: null,
        },
      };
    default:
      return { type: "ignored", event };
  }
}

export interface ZidTokenResponse {
  authorization: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export function zidAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const u = new URL(`${ZID_OAUTH}/oauth/authorize`);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeZidCode(
  code: string,
  opts: { clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: FetchLike = fetch,
): Promise<StoreCredentials> {
  const res = await fetchImpl(`${ZID_OAUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      code,
    }),
  });
  if (!res.ok) throw new Error(`Zid token exchange failed: ${res.status}`);
  const t = (await res.json()) as ZidTokenResponse;
  return {
    accessToken: t.authorization,
    managerToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : undefined,
  };
}
