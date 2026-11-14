import { randomUUID } from "node:crypto";
import { passesFilters, score, tokens } from "../search";
import type { AttributedOrder, Click, NewProduct, Platform, Product, ProductSearch, SearchResult, Store, StoreCredentials } from "../types";
import type { NewStore, Repository, StoreStats } from "./types";

/** In-process storage for local development and tests. Data is lost on restart. */
export class MemoryRepository implements Repository {
  readonly kind = "memory" as const;
  private stores = new Map<string, Store>();
  private creds = new Map<string, StoreCredentials>();
  private products = new Map<string, Product>();
  private clicks: Click[] = [];
  private orders: AttributedOrder[] = [];

  async getStore(id: string) {
    return this.stores.get(id) ?? null;
  }

  async findStore(platform: Platform, externalId: string) {
    for (const s of this.stores.values()) if (s.platform === platform && s.externalId === externalId) return s;
    return null;
  }

  async upsertStore(input: NewStore) {
    const existing = await this.findStore(input.platform, input.externalId);
    const store: Store = { ...existing, ...input, id: existing?.id ?? randomUUID(), lastSyncedAt: existing?.lastSyncedAt ?? null };
    this.stores.set(store.id, store);
    return store;
  }

  async setStoreStatus(id: string, status: Store["status"]) {
    const s = this.stores.get(id);
    if (s) s.status = status;
  }

  async markSynced(id: string) {
    const s = this.stores.get(id);
    if (s) s.lastSyncedAt = new Date().toISOString();
  }

  async listActiveStores() {
    return [...this.stores.values()].filter((s) => s.status === "active");
  }

  async getCredentials(storeId: string) {
    return this.creds.get(storeId) ?? null;
  }

  async saveCredentials(storeId: string, creds: StoreCredentials) {
    this.creds.set(storeId, { ...creds });
  }

  async upsertProducts(storeId: string, list: NewProduct[]) {
    const now = new Date().toISOString();
    for (const p of list) {
      const existing = [...this.products.values()].find((x) => x.storeId === storeId && x.externalId === p.externalId);
      const product: Product = { ...p, storeId, id: existing?.id ?? randomUUID(), updatedAt: now };
      this.products.set(product.id, product);
    }
    return list.length;
  }

  async deleteProduct(storeId: string, externalId: string) {
    for (const [id, p] of this.products) if (p.storeId === storeId && p.externalId === externalId) this.products.delete(id);
  }

  async pruneProducts(storeId: string, keep: string[]) {
    const keepSet = new Set(keep);
    let removed = 0;
    for (const [id, p] of this.products) {
      if (p.storeId === storeId && !keepSet.has(p.externalId)) {
        this.products.delete(id);
        removed++;
      }
    }
    return removed;
  }

  async getProduct(id: string) {
    return this.products.get(id) ?? null;
  }

  async search(q: ProductSearch): Promise<SearchResult[]> {
    const t = tokens(q.query ?? "");
    const limit = Math.min(Math.max(q.limit ?? 10, 1), 50);
    const results: { r: SearchResult; s: number }[] = [];
    for (const p of this.products.values()) {
      const store = this.stores.get(p.storeId);
      if (!store || store.status !== "active") continue;
      if (q.country && store.shipsTo.length && !store.shipsTo.includes(q.country.toUpperCase())) continue;
      if (!passesFilters(p, q)) continue;
      const s = score(p, t);
      if (s <= 0) continue;
      results.push({ r: { product: p, store: { id: store.id, name: store.name, domain: store.domain, platform: store.platform, shipsTo: store.shipsTo } }, s });
    }
    return results.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.r);
  }

  async recordClick(click: Click) {
    this.clicks.push(click);
  }

  async findRecentClick(storeId: string, productExternalIds: string[], sinceIso: string) {
    const ext = new Set(productExternalIds);
    const since = Date.parse(sinceIso);
    for (let i = this.clicks.length - 1; i >= 0; i--) {
      const c = this.clicks[i]!;
      if (c.storeId !== storeId || Date.parse(c.createdAt) < since) continue;
      const p = this.products.get(c.productId);
      if (p && ext.has(p.externalId)) return c;
    }
    return null;
  }

  async linkExists(linkId: string, storeId: string) {
    return this.clicks.some((c) => c.linkId === linkId && c.storeId === storeId);
  }

  async recordOrder(order: AttributedOrder) {
    const i = this.orders.findIndex((o) => o.storeId === order.storeId && o.externalOrderId === order.externalOrderId);
    if (i >= 0) this.orders[i] = order;
    else this.orders.push(order);
  }

  async stats(storeId: string): Promise<StoreStats> {
    const orders = this.orders.filter((o) => o.storeId === storeId && o.attribution !== "none");
    return {
      products: [...this.products.values()].filter((p) => p.storeId === storeId).length,
      clicks: this.clicks.filter((c) => c.storeId === storeId).length,
      orders: orders.length,
      attributedRevenue: orders.reduce((sum, o) => sum + o.total, 0),
    };
  }
}
