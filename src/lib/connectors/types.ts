import type { NewProduct, Platform, Product, ProductVariant, Store, StoreCredentials } from "../types";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface OrderEvent {
  externalOrderId: string;
  total: number;
  currency: string;
  status: string;
  productExternalIds: string[];
  /** The `wasl_ref` the store kept from our link, when the platform passes it through. */
  ref?: string | null;
}

export type WebhookEvent =
  | { type: "order"; storeExternalId: string; order: OrderEvent }
  | { type: "product_changed"; storeExternalId: string; productExternalId: string }
  | { type: "product_deleted"; storeExternalId: string; productExternalId: string }
  | { type: "app_authorized"; storeExternalId: string; credentials: StoreCredentials }
  | { type: "app_uninstalled"; storeExternalId: string }
  | { type: "ignored"; event: string };

export interface CartTarget {
  url: string;
  /** "cart" = the item is already in the cart; "product_page" = the customer taps "add to cart" themselves. */
  kind: "cart" | "product_page";
}

export interface Connector {
  platform: Platform;
  /** Yields pages of products, already mapped to the shared shape. */
  fetchProducts(store: Store, creds: StoreCredentials, fetchImpl?: FetchLike): AsyncGenerator<NewProduct[]>;
  cartTarget(store: Store, product: Product, variant: ProductVariant | undefined, quantity: number): CartTarget;
}
