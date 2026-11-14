import { connectorFor, type WebhookEvent } from "./connectors";
import { refreshSallaToken } from "./connectors/salla";
import { getRepo, type Repository } from "./db";
import { env } from "./env";
import { createLinkToken, linkUrl } from "./links";
import { effectivePrice } from "./search";
import type { Platform, Product, ProductSearch, SearchResult, Store } from "./types";

/** Shape returned to agents: compact, no internal fields. */
export function publicProduct(p: Product, store: SearchResult["store"]) {
  return {
    id: p.id,
    title: p.title,
    description: p.description.slice(0, 600),
    price: effectivePrice(p),
    original_price: p.salePrice ? p.price : undefined,
    currency: p.currency,
    availability: p.availability,
    brand: p.brand ?? undefined,
    category: p.category ?? undefined,
    image_url: p.imageUrl ?? undefined,
    attributes: Object.keys(p.attributes).length ? p.attributes : undefined,
    variants: p.variants.length
      ? p.variants.map((v) => ({ id: v.externalId, title: v.title, price: v.salePrice ?? v.price, availability: v.availability }))
      : undefined,
    product_page: p.url,
    store: { id: store.id, name: store.name, ships_to: store.shipsTo },
  };
}

export async function searchProducts(q: ProductSearch) {
  const repo = await getRepo();
  const results = await repo.search(q);
  return results.map((r) => publicProduct(r.product, r.store));
}

export async function getProductWithStore(id: string, repo?: Repository) {
  const r = repo ?? (await getRepo());
  const product = await r.getProduct(id);
  if (!product) return null;
  const store = await r.getStore(product.storeId);
  if (!store || store.status !== "active") return null;
  return { product, store };
}

export class CheckoutError extends Error {
  constructor(public code: "not_found" | "out_of_stock" | "bad_variant", message: string) {
    super(message);
  }
}

/** Builds the link an agent gives the customer. The customer pays on the merchant's own checkout. */
export async function createCheckoutLink(input: { productId: string; variantId?: string; quantity?: number; agent?: string }) {
  const found = await getProductWithStore(input.productId);
  if (!found) throw new CheckoutError("not_found", "Product not found");
  const { product, store } = found;
  const variant = input.variantId ? product.variants.find((v) => v.externalId === input.variantId) : undefined;
  if (input.variantId && !variant) throw new CheckoutError("bad_variant", "Unknown variant for this product");
  if ((variant?.availability ?? product.availability) !== "in_stock") throw new CheckoutError("out_of_stock", "Product is out of stock");

  const quantity = Math.min(Math.max(Math.floor(input.quantity ?? 1), 1), 20);
  const target = connectorFor(store.platform).cartTarget(store, product, variant, quantity);
  const { token, payload } = createLinkToken({
    storeId: store.id,
    productId: product.id,
    variantId: variant?.externalId,
    quantity,
    baseUrl: target.url,
    agent: input.agent?.replace(/[^\w.-]/g, "").slice(0, 40) || undefined,
  });

  const unit = variant ? variant.salePrice ?? variant.price : effectivePrice(product);
  return {
    checkout_url: linkUrl(token),
    lands_on: target.kind,
    note:
      target.kind === "cart"
        ? "The item is already in the cart. The customer reviews and pays on the store's own checkout."
        : `The customer lands on the product page and taps "add to cart"${quantity > 1 ? ` (quantity ${quantity})` : ""}, then pays on the store's own checkout.`,
    store: store.name,
    product: product.title,
    variant: variant?.title,
    quantity,
    estimated_total: Math.round(unit * quantity * 100) / 100,
    currency: product.currency,
    expires_at: new Date(payload.exp * 1000).toISOString(),
  };
}

/** Pulls every product from the store and replaces the catalogue copy. */
export async function syncStore(store: Store, repo?: Repository, fetchImpl?: typeof fetch) {
  const r = repo ?? (await getRepo());
  let creds = await r.getCredentials(store.id);
  if (!creds) throw new Error(`No credentials for store ${store.id}`);
  // Salla access tokens last ~14 days and refresh tokens are single-use: refresh ahead of expiry, once, here.
  // Only the daily cron and install hooks call syncStore, which keeps concurrent refreshes unlikely.
  if (store.platform === "salla" && creds.expiresAt && Date.parse(creds.expiresAt) - Date.now() < 3 * 24 * 3600_000) {
    if (!env.sallaClientId || !env.sallaClientSecret) throw new Error("SALLA_CLIENT_ID/SECRET needed to refresh tokens");
    creds = await refreshSallaToken(creds, env.sallaClientId, env.sallaClientSecret, fetchImpl);
    await r.saveCredentials(store.id, creds);
  }
  const seen: string[] = [];
  let count = 0;
  for await (const page of connectorFor(store.platform).fetchProducts(store, creds, fetchImpl)) {
    count += await r.upsertProducts(store.id, page);
    seen.push(...page.map((p) => p.externalId));
  }
  const removed = await r.pruneProducts(store.id, seen);
  await r.markSynced(store.id);
  return { storeId: store.id, synced: count, removed };
}

/** Applies a parsed webhook. Store creation for new installs happens in the platform route. */
export async function handleWebhookEvent(platform: Platform, ev: WebhookEvent, repo?: Repository) {
  const r = repo ?? (await getRepo());
  if (ev.type === "ignored") return { handled: false, reason: `ignored event ${ev.event}` };
  const store = await r.findStore(platform, ev.storeExternalId);
  if (!store) return { handled: false, reason: "unknown store" };

  switch (ev.type) {
    case "app_authorized":
      await r.saveCredentials(store.id, { ...(await r.getCredentials(store.id)), ...ev.credentials });
      await r.setStoreStatus(store.id, "active");
      return { handled: true };
    case "app_uninstalled":
      await r.setStoreStatus(store.id, "uninstalled");
      return { handled: true };
    case "product_deleted":
      await r.deleteProduct(store.id, ev.productExternalId);
      return { handled: true };
    case "product_changed":
      // Simplest correct behaviour for now: mark for re-sync on the next cron run.
      // A per-product fetch is a later optimisation.
      return { handled: true, resync: true };
    case "order": {
      const o = ev.order;
      let linkId: string | null = null;
      let attribution: "exact" | "probable" | "none" = "none";
      if (o.ref && (await r.linkExists(o.ref, store.id))) {
        linkId = o.ref;
        attribution = "exact";
      } else {
        const since = new Date(Date.now() - env.attributionWindowHours * 3600_000).toISOString();
        const click = await r.findRecentClick(store.id, o.productExternalIds, since);
        if (click) {
          linkId = click.linkId;
          attribution = "probable";
        }
      }
      await r.recordOrder({ ...o, storeId: store.id, linkId, attribution, createdAt: new Date().toISOString() });
      return { handled: true, attribution };
    }
  }
}
