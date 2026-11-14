export type Platform = "salla" | "zid" | "woocommerce";

export type Availability = "in_stock" | "out_of_stock";

/** A merchant store connected to Wasl. Credentials are stored encrypted. */
export interface Store {
  id: string;
  platform: Platform;
  /** The store's id on its own platform (Salla merchant id, Zid store id, or the Woo site URL). */
  externalId: string;
  name: string;
  /** Storefront base URL, e.g. https://example.com */
  domain: string;
  currency: string;
  /** ISO 3166-1 alpha-2 codes the store ships to. */
  shipsTo: string[];
  status: "active" | "paused" | "uninstalled";
  plan: "free" | "growth" | "pro";
  lastSyncedAt?: string | null;
}

export interface StoreCredentials {
  /** Salla: bearer token. Zid: the `authorization` token. */
  accessToken?: string;
  refreshToken?: string;
  /** Zid only: X-Manager-Token. */
  managerToken?: string;
  /** WooCommerce REST API key pair. */
  consumerKey?: string;
  consumerSecret?: string;
  /** Per-store webhook secret (WooCommerce webhooks, Zid target-URL token). */
  webhookSecret?: string;
  expiresAt?: string;
}

export interface ProductVariant {
  externalId: string;
  title: string;
  price: number;
  salePrice?: number | null;
  availability: Availability;
  sku?: string | null;
  attributes: Record<string, string>;
}

/** The one product shape every connector maps into. */
export interface Product {
  id: string;
  storeId: string;
  externalId: string;
  title: string;
  description: string;
  brand?: string | null;
  url: string;
  imageUrl?: string | null;
  price: number;
  salePrice?: number | null;
  currency: string;
  availability: Availability;
  quantity?: number | null;
  sku?: string | null;
  category?: string | null;
  attributes: Record<string, string>;
  variants: ProductVariant[];
  updatedAt: string;
}

export type NewProduct = Omit<Product, "id" | "updatedAt">;

export interface ProductSearch {
  query?: string;
  maxPrice?: number;
  minPrice?: number;
  currency?: string;
  country?: string;
  inStockOnly?: boolean;
  limit?: number;
}

export interface SearchResult {
  product: Product;
  store: Pick<Store, "id" | "name" | "domain" | "platform" | "shipsTo">;
}

export interface Click {
  linkId: string;
  storeId: string;
  productId: string;
  agent?: string | null;
  createdAt: string;
}

export type Attribution = "exact" | "probable" | "none";

export interface AttributedOrder {
  storeId: string;
  externalOrderId: string;
  total: number;
  currency: string;
  status: string;
  productExternalIds: string[];
  linkId?: string | null;
  attribution: Attribution;
  createdAt: string;
}
