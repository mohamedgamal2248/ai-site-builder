import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "../crypto";
import { normalize, passesFilters, score, tokens } from "../search";
import type { AttributedOrder, Click, NewProduct, Platform, Product, ProductSearch, SearchResult, Store, StoreCredentials } from "../types";
import type { NewStore, Repository, StoreStats } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function toStore(r: Row): Store {
  return {
    id: r.id,
    platform: r.platform,
    externalId: r.external_id,
    name: r.name,
    domain: r.domain,
    currency: r.currency,
    shipsTo: r.ships_to ?? [],
    status: r.status,
    plan: r.plan,
    lastSyncedAt: r.last_synced_at,
  };
}

function toProduct(r: Row): Product {
  return {
    id: r.id,
    storeId: r.store_id,
    externalId: r.external_id,
    title: r.title,
    description: r.description ?? "",
    brand: r.brand,
    url: r.url,
    imageUrl: r.image_url,
    price: Number(r.price),
    salePrice: r.sale_price == null ? null : Number(r.sale_price),
    currency: r.currency,
    availability: r.availability,
    quantity: r.quantity,
    sku: r.sku,
    category: r.category,
    attributes: r.attributes ?? {},
    variants: r.variants ?? [],
    updatedAt: r.updated_at,
  };
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string, private tokenKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  async getStore(id: string) {
    const r = check(await this.db.from("stores").select("*").eq("id", id).maybeSingle());
    return r ? toStore(r) : null;
  }

  async findStore(platform: Platform, externalId: string) {
    const r = check(await this.db.from("stores").select("*").eq("platform", platform).eq("external_id", externalId).maybeSingle());
    return r ? toStore(r) : null;
  }

  async upsertStore(s: NewStore) {
    const r = check(
      await this.db
        .from("stores")
        .upsert(
          { platform: s.platform, external_id: s.externalId, name: s.name, domain: s.domain, currency: s.currency, ships_to: s.shipsTo, status: s.status, plan: s.plan },
          { onConflict: "platform,external_id" },
        )
        .select("*")
        .single(),
    );
    return toStore(r);
  }

  async setStoreStatus(id: string, status: Store["status"]) {
    check(await this.db.from("stores").update({ status }).eq("id", id));
  }

  async markSynced(id: string) {
    check(await this.db.from("stores").update({ last_synced_at: new Date().toISOString() }).eq("id", id));
  }

  async listActiveStores() {
    return (check(await this.db.from("stores").select("*").eq("status", "active")) ?? []).map(toStore);
  }

  async getCredentials(storeId: string) {
    const r = check(await this.db.from("store_credentials").select("payload").eq("store_id", storeId).maybeSingle());
    return r ? (JSON.parse(decrypt(r.payload, this.tokenKey)) as StoreCredentials) : null;
  }

  async saveCredentials(storeId: string, creds: StoreCredentials) {
    check(
      await this.db
        .from("store_credentials")
        .upsert({ store_id: storeId, payload: encrypt(JSON.stringify(creds), this.tokenKey), updated_at: new Date().toISOString() }, { onConflict: "store_id" }),
    );
  }

  async upsertProducts(storeId: string, list: NewProduct[]) {
    if (list.length === 0) return 0;
    const now = new Date().toISOString();
    const rows = list.map((p) => ({
      store_id: storeId,
      external_id: p.externalId,
      title: p.title,
      description: p.description,
      brand: p.brand,
      url: p.url,
      image_url: p.imageUrl,
      price: p.price,
      sale_price: p.salePrice,
      currency: p.currency,
      availability: p.availability,
      quantity: p.quantity,
      sku: p.sku,
      category: p.category,
      attributes: p.attributes,
      variants: p.variants,
      search_text: normalize(`${p.title} ${p.category ?? ""} ${p.brand ?? ""} ${Object.values(p.attributes).join(" ")} ${p.description.slice(0, 1500)}`),
      updated_at: now,
    }));
    check(await this.db.from("products").upsert(rows, { onConflict: "store_id,external_id" }));
    return rows.length;
  }

  async deleteProduct(storeId: string, externalId: string) {
    check(await this.db.from("products").delete().eq("store_id", storeId).eq("external_id", externalId));
  }

  async pruneProducts(storeId: string, keep: string[]) {
    const existing = (check(await this.db.from("products").select("id, external_id").eq("store_id", storeId)) ?? []) as Row[];
    const keepSet = new Set(keep);
    const gone = existing.filter((r) => !keepSet.has(r.external_id)).map((r) => r.id);
    for (let i = 0; i < gone.length; i += 200) check(await this.db.from("products").delete().in("id", gone.slice(i, i + 200)));
    return gone.length;
  }

  async getProduct(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const r = check(await this.db.from("products").select("*").eq("id", id).maybeSingle());
    return r ? toProduct(r) : null;
  }

  async search(q: ProductSearch): Promise<SearchResult[]> {
    const t = tokens(q.query ?? "");
    const limit = Math.min(Math.max(q.limit ?? 10, 1), 50);
    // Candidate fetch in the database, final ranking in code (same scoring as the memory store).
    let query = this.db.from("products").select("*, stores!inner(id, name, domain, platform, ships_to, status)").eq("stores.status", "active");
    if (q.inStockOnly !== false) query = query.eq("availability", "in_stock");
    if (q.currency) query = query.eq("currency", q.currency.toUpperCase());
    if (q.country) query = query.contains("stores.ships_to", [q.country.toUpperCase()]);
    const safe = t.map((x) => x.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
    if (safe.length) query = query.or(safe.map((x) => `search_text.ilike.%${x}%`).join(","));
    const rows = (check(await query.limit(300)) ?? []) as Row[];

    return rows
      .map((r) => ({ product: toProduct(r), store: r.stores as Row }))
      .filter(({ product }) => passesFilters(product, q))
      .map(({ product, store }) => ({ product, store, s: score(product, t) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(({ product, store }) => ({
        product,
        store: { id: store.id, name: store.name, domain: store.domain, platform: store.platform, shipsTo: store.ships_to ?? [] },
      }));
  }

  async recordClick(c: Click) {
    check(await this.db.from("clicks").insert({ link_id: c.linkId, store_id: c.storeId, product_id: c.productId, agent: c.agent, created_at: c.createdAt }));
  }

  async findRecentClick(storeId: string, productExternalIds: string[], sinceIso: string) {
    if (productExternalIds.length === 0) return null;
    const r = check(
      await this.db
        .from("clicks")
        .select("link_id, store_id, product_id, agent, created_at, products!inner(external_id)")
        .eq("store_id", storeId)
        .gte("created_at", sinceIso)
        .in("products.external_id", productExternalIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ) as Row | null;
    return r ? { linkId: r.link_id, storeId: r.store_id, productId: r.product_id, agent: r.agent, createdAt: r.created_at } : null;
  }

  async linkExists(linkId: string, storeId: string) {
    const r = check(await this.db.from("clicks").select("link_id").eq("link_id", linkId).eq("store_id", storeId).limit(1));
    return (r ?? []).length > 0;
  }

  async recordOrder(o: AttributedOrder) {
    check(
      await this.db.from("orders").upsert(
        {
          store_id: o.storeId,
          external_order_id: o.externalOrderId,
          total: o.total,
          currency: o.currency,
          status: o.status,
          product_external_ids: o.productExternalIds,
          link_id: o.linkId,
          attribution: o.attribution,
          created_at: o.createdAt,
        },
        { onConflict: "store_id,external_order_id" },
      ),
    );
  }

  async stats(storeId: string): Promise<StoreStats> {
    const count = async (table: string, extra?: (q: any) => any) => {
      let q: any = this.db.from(table).select("*", { count: "exact", head: true }).eq("store_id", storeId);
      if (extra) q = extra(q);
      const res = await q;
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    };
    const revenueRows = (check(await this.db.from("orders").select("total").eq("store_id", storeId).neq("attribution", "none")) ?? []) as Row[];
    return {
      products: await count("products"),
      clicks: await count("clicks"),
      orders: revenueRows.length,
      attributedRevenue: revenueRows.reduce((s, r) => s + Number(r.total), 0),
    };
  }
}
