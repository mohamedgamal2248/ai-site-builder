/**
 * WooCommerce connector (REST API v3).
 * - Products: GET {site}/wp-json/wc/v3/products with the store's consumer key/secret (HTTPS only).
 * - Webhooks: header `X-WC-Webhook-Signature` = base64(HMAC-SHA256(raw body, webhook secret)).
 * - Cart: `{site}/?add-to-cart=<id>&quantity=<n>` puts the item straight into the cart.
 * - Exact attribution needs the companion WordPress plugin, which saves `wasl_ref` on the order
 *   as `_wasl_ref` meta.
 */
import { hmacSha256, safeEqual } from "../crypto";
import type { NewProduct, Product, ProductVariant, Store, StoreCredentials } from "../types";
import type { CartTarget, Connector, FetchLike, WebhookEvent } from "./types";
import { absoluteUrl, arr, getJson, num, obj, str, stripHtml } from "./util";

export function mapWooProduct(raw: unknown, store: Store): NewProduct | null {
  const p = obj(raw);
  if (str(p.status) && str(p.status) !== "publish") return null;
  if (str(p.catalog_visibility) === "hidden") return null;
  const externalId = str(p.id);
  const url = str(p.permalink);
  if (!externalId || !url) return null;

  const regular = num(p.regular_price);
  const price = num(p.price) ?? regular ?? 0;
  const sale = num(p.sale_price);
  const attributes: Record<string, string> = {};
  for (const a of arr(p.attributes).map(obj)) {
    const name = str(a.name);
    const options = arr(a.options).map(str).filter(Boolean);
    if (name && options.length) attributes[name] = options.join(", ");
  }

  return {
    storeId: store.id,
    externalId,
    title: str(p.name),
    description: stripHtml(str(p.short_description) || str(p.description)).slice(0, 5000),
    brand: null,
    url,
    imageUrl: str(obj(arr(p.images)[0]).src) || null,
    price: regular && sale ? regular : price,
    salePrice: regular && sale && sale < regular ? sale : null,
    currency: store.currency,
    availability: str(p.stock_status) === "outofstock" ? "out_of_stock" : "in_stock",
    quantity: num(p.stock_quantity),
    sku: str(p.sku) || null,
    category: str(obj(arr(p.categories)[0]).name) || null,
    attributes,
    // Variable products list variation ids only; fetching each variation is a later step.
    variants: [] as ProductVariant[],
  };
}

export const wooConnector: Connector = {
  platform: "woocommerce",

  async *fetchProducts(store: Store, creds: StoreCredentials, fetchImpl: FetchLike = fetch) {
    if (!creds.consumerKey || !creds.consumerSecret) throw new Error("WooCommerce store is missing API keys");
    if (!store.domain.startsWith("https://")) throw new Error("WooCommerce API keys are only sent over HTTPS");
    const auth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");
    const headers = { Authorization: `Basic ${auth}` };
    for (let page = 1; page <= 500; page++) {
      const url = absoluteUrl(store.domain, `wp-json/wc/v3/products?status=publish&per_page=50&page=${page}`);
      const items = arr(await getJson(fetchImpl, url, headers));
      yield items.map((r) => mapWooProduct(r, store)).filter((p): p is NewProduct => p !== null);
      if (items.length < 50) break;
    }
  },

  cartTarget(store: Store, product: Product, variant: ProductVariant | undefined, quantity: number): CartTarget {
    const u = new URL(absoluteUrl(store.domain, "cart/"));
    u.searchParams.set("add-to-cart", variant?.externalId || product.externalId);
    u.searchParams.set("quantity", String(Math.max(1, Math.floor(quantity))));
    return { url: u.toString(), kind: "cart" };
  },
};

export function verifyWooWebhook(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  return safeEqual(signature.trim(), hmacSha256(secret, rawBody, "base64"));
}

export function parseWooWebhook(topic: string, source: string, body: unknown): WebhookEvent {
  const d = obj(body);
  switch (topic) {
    case "product.created":
    case "product.updated":
    case "product.restored":
      return { type: "product_changed", storeExternalId: source, productExternalId: str(d.id) };
    case "product.deleted":
      return { type: "product_deleted", storeExternalId: source, productExternalId: str(d.id) };
    case "order.created": {
      const ref = arr(d.meta_data).map(obj).find((m) => str(m.key) === "_wasl_ref");
      return {
        type: "order",
        storeExternalId: source,
        order: {
          externalOrderId: str(d.id),
          total: num(d.total) ?? 0,
          currency: str(d.currency) || "USD",
          status: str(d.status) || "pending",
          productExternalIds: arr(d.line_items).map((i) => str(obj(i).product_id)).filter(Boolean),
          ref: ref ? str(ref.value) || null : null,
        },
      };
    }
    default:
      return { type: "ignored", event: topic };
  }
}
