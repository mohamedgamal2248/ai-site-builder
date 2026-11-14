import type { AttributedOrder, Click, NewProduct, Platform, Product, ProductSearch, SearchResult, Store, StoreCredentials } from "../types";

export type NewStore = Omit<Store, "id" | "lastSyncedAt">;

export interface StoreStats {
  products: number;
  clicks: number;
  orders: number;
  attributedRevenue: number;
}

export interface Repository {
  readonly kind: "memory" | "supabase";

  getStore(id: string): Promise<Store | null>;
  findStore(platform: Platform, externalId: string): Promise<Store | null>;
  /** Creates or updates by (platform, externalId). */
  upsertStore(store: NewStore): Promise<Store>;
  setStoreStatus(id: string, status: Store["status"]): Promise<void>;
  markSynced(id: string): Promise<void>;
  listActiveStores(): Promise<Store[]>;

  getCredentials(storeId: string): Promise<StoreCredentials | null>;
  saveCredentials(storeId: string, creds: StoreCredentials): Promise<void>;

  upsertProducts(storeId: string, products: NewProduct[]): Promise<number>;
  deleteProduct(storeId: string, externalId: string): Promise<void>;
  /** Removes products that disappeared from the store during a full sync. */
  pruneProducts(storeId: string, keepExternalIds: string[]): Promise<number>;
  getProduct(id: string): Promise<Product | null>;
  search(query: ProductSearch): Promise<SearchResult[]>;

  recordClick(click: Click): Promise<void>;
  /** Latest click on any of these products in the window, for "probable" attribution. */
  findRecentClick(storeId: string, productExternalIds: string[], sinceIso: string): Promise<Click | null>;
  linkExists(linkId: string, storeId: string): Promise<boolean>;
  recordOrder(order: AttributedOrder): Promise<void>;
  stats(storeId: string): Promise<StoreStats>;
}
