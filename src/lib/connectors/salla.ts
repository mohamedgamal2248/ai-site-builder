/**
 * Salla connector.
 * Docs: https://docs.salla.dev  (Merchant API base https://api.salla.dev/admin/v2)
 * - Published apps must use "Easy Mode": Salla sends tokens in the `app.store.authorize` webhook.
 * - Webhooks are signed: HMAC-SHA256(raw body, webhook secret) in hex, header `x-salla-signature`.
 * - There is no documented URL that pre-fills a Salla cart, so links land on the product page.
 */
import { hmacSha256, safeEqual } from "../crypto";
import type { NewProduct, Product, ProductVariant, Store, StoreCredentials } from "../types";
import type { CartTarget, Connector, FetchLike, WebhookEvent } from "./types";
import { arr, getJson, num, obj, str, stripHtml } from "./util";

export const SALLA_API = "https://api.salla.dev/admin/v2";
export const SALLA_TOKEN_URL = "https://accounts.salla.sa/oauth2/token";

export function mapSallaProduct(raw: unknown, store: Store): NewProduct | null {
  const p = obj(raw);
  const status = str(p.status);
  if (status === "hidden" || status === "deleted") return null;
  const externalId = str(p.id);
  const url = str(p.url) || str(obj(p.urls).customer);
  if (!externalId || !url) return null;

  const price = num(p.price) ?? 0;
  const salePrice = num(p.sale_price);
  const currency = str(obj(p.price).currency) || store.currency;
  const images = arr(p.images).map(obj);
  const main = images.find((i) => i.main === true) ?? images[0];
  const quantity = num(p.quantity);
  const unlimited = p.unlimited_quantity === true;

  const variants: ProductVariant[] = arr(p.skus).map((s) => {
    const sku = obj(s);
    const stock = num(sku.stock_quantity);
    return {
      externalId: str(sku.id),
      title: arr(sku.related_option_values).map(str).filter(Boolean).join(" / ") || str(sku.sku),
      price: num(sku.price) ?? price,
      salePrice: num(sku.sale_price),
      availability: stock === null || stock > 0 ? "in_stock" : "out_of_stock",
      sku: str(sku.sku) || null,
      attributes: {},
    };
  });

  return {
    storeId: store.id,
    externalId,
    title: str(p.name),
    description: stripHtml(str(p.description)).slice(0, 5000),
    brand: str(obj(p.brand).name) || null,
    url,
    imageUrl: str(main?.url) || null,
    price,
    salePrice: salePrice && salePrice > 0 && salePrice < price ? salePrice : null,
    currency,
    availability: status === "out" || (!unlimited && quantity !== null && quantity <= 0) ? "out_of_stock" : "in_stock",
    quantity: unlimited ? null : quantity,
    sku: str(p.sku) || null,
    category: str(obj(arr(p.categories)[0]).name) || null,
    attributes: {},
    variants,
  };
}

export const sallaConnector: Connector = {
  platform: "salla",

  async *fetchProducts(store: Store, creds: StoreCredentials, fetchImpl: FetchLike = fetch) {
    if (!creds.accessToken) throw new Error("Salla store has no access token");
    const headers = { Authorization: `Bearer ${creds.accessToken}` };
    let page = 1;
    for (let guard = 0; guard < 500; guard++) {
      const body = obj(await getJson(fetchImpl, `${SALLA_API}/products?page=${page}&per_page=50`, headers));
      const items = arr(body.data).map((r) => mapSallaProduct(r, store)).filter((p): p is NewProduct => p !== null);
      yield items;
      const pg = obj(body.pagination);
      const totalPages = num(pg.totalPages);
      const hasNext = pg.next ? true : totalPages !== null ? page < totalPages : false;
      if (!hasNext || arr(body.data).length === 0) break;
      page++;
    }
  },

  cartTarget(_store: Store, product: Product): CartTarget {
    return { url: product.url, kind: "product_page" };
  },
};

export function verifySallaWebhook(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  return safeEqual(signature.trim().toLowerCase(), hmacSha256(secret, rawBody, "hex"));
}

export function parseSallaWebhook(body: unknown): WebhookEvent {
  const b = obj(body);
  const event = str(b.event);
  const merchant = str(b.merchant);
  const data = obj(b.data);

  switch (event) {
    case "app.store.authorize": {
      const expires = num(data.expires);
      return {
        type: "app_authorized",
        storeExternalId: merchant,
        credentials: {
          accessToken: str(data.access_token),
          refreshToken: str(data.refresh_token) || undefined,
          // The docs call `expires` both a timestamp and a lifetime; values above 1e9 are treated as a unix timestamp.
          expiresAt: expires ? new Date(expires > 1e9 ? expires * 1000 : Date.now() + expires * 1000).toISOString() : undefined,
        },
      };
    }
    case "app.uninstalled":
      return { type: "app_uninstalled", storeExternalId: merchant };
    case "product.created":
    case "product.updated":
    case "product.price.updated":
    case "product.status.updated":
    case "product.quantity.low":
    case "product.image.updated":
      return { type: "product_changed", storeExternalId: merchant, productExternalId: str(data.id) };
    case "product.deleted":
      return { type: "product_deleted", storeExternalId: merchant, productExternalId: str(data.id) };
    case "order.created": {
      const amounts = obj(data.amounts);
      const total = obj(amounts.total);
      return {
        type: "order",
        storeExternalId: merchant,
        order: {
          externalOrderId: str(data.id) || str(data.reference_id),
          total: num(total.amount) ?? num(data.total) ?? 0,
          currency: str(total.currency) || str(data.currency) || "SAR",
          status: str(obj(data.status).slug) || str(data.status) || "created",
          productExternalIds: arr(data.items)
            .map((i) => str(obj(obj(i).product).id) || str(obj(i).product_id))
            .filter(Boolean),
          ref: null,
        },
      };
    }
    default:
      return { type: "ignored", event };
  }
}

/** Salla refresh tokens are single use: callers must serialise refreshes per store. */
export async function refreshSallaToken(creds: StoreCredentials, clientId: string, clientSecret: string, fetchImpl: FetchLike = fetch): Promise<StoreCredentials> {
  if (!creds.refreshToken) throw new Error("No Salla refresh token");
  const res = await fetchImpl(SALLA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: creds.refreshToken, client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Salla token refresh failed: ${res.status}`);
  const t = obj(await res.json());
  const expiresIn = num(t.expires_in) ?? num(t.expires) ?? 0;
  return {
    ...creds,
    accessToken: str(t.access_token),
    refreshToken: str(t.refresh_token) || creds.refreshToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined,
  };
}
