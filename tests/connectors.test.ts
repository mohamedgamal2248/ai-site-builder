import { describe, expect, it } from "vitest";
import { hmacSha256 } from "@/lib/crypto";
import { mapSallaProduct, parseSallaWebhook, sallaConnector, verifySallaWebhook } from "@/lib/connectors/salla";
import { mapWooProduct, parseWooWebhook, verifyWooWebhook, wooConnector } from "@/lib/connectors/woocommerce";
import { mapZidProduct, parseZidWebhook, verifyZidWebhook, zidWebhookToken } from "@/lib/connectors/zid";
import type { Product, Store } from "@/lib/types";

const store = (platform: Store["platform"], domain = "https://shop.example.com"): Store => ({
  id: "store-1", platform, externalId: "ext", name: "S", domain, currency: "SAR", shipsTo: ["SA"], status: "active", plan: "free",
});

describe("salla", () => {
  const raw = {
    id: 123, name: "عطر", description: "<p>وصف <b>جميل</b></p>", url: "https://shop.example.com/p123",
    price: { amount: 200, currency: "SAR" }, sale_price: { amount: 150, currency: "SAR" }, quantity: 4, status: "sale", sku: "A1",
    images: [{ url: "https://img/1.jpg", main: false }, { url: "https://img/2.jpg", main: true }],
    skus: [{ id: 9, price: { amount: 210 }, stock_quantity: 0, sku: "A1-L", related_option_values: ["L"] }],
  };
  it("maps a product", () => {
    const p = mapSallaProduct(raw, store("salla"))!;
    expect(p).toMatchObject({ externalId: "123", title: "عطر", description: "وصف جميل", price: 200, salePrice: 150, imageUrl: "https://img/2.jpg", availability: "in_stock" });
    expect(p.variants[0]).toMatchObject({ externalId: "9", price: 210, availability: "out_of_stock", title: "L" });
  });
  it("skips hidden products", () => {
    expect(mapSallaProduct({ ...raw, status: "hidden" }, store("salla"))).toBeNull();
  });
  it("paginates", async () => {
    const pages = [
      { data: [raw], pagination: { next: "x" } },
      { data: [{ ...raw, id: 124 }], pagination: { next: null } },
    ];
    let call = 0;
    const fake = async (url: string, init?: RequestInit) => {
      expect(url).toContain(`page=${call + 1}`);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return new Response(JSON.stringify(pages[call++]));
    };
    const all = [];
    for await (const page of sallaConnector.fetchProducts(store("salla"), { accessToken: "tok" }, fake)) all.push(...page);
    expect(all.map((p) => p.externalId)).toEqual(["123", "124"]);
  });
  it("verifies signatures", () => {
    const body = JSON.stringify({ event: "order.created" });
    expect(verifySallaWebhook(body, hmacSha256("sec", body), "sec")).toBe(true);
    expect(verifySallaWebhook(body, hmacSha256("other", body), "sec")).toBe(false);
    expect(verifySallaWebhook(body, null, "sec")).toBe(false);
  });
  it("parses authorize and order events", () => {
    const auth = parseSallaWebhook({ event: "app.store.authorize", merchant: 55, data: { access_token: "a", refresh_token: "r", expires: 1209599 } });
    expect(auth).toMatchObject({ type: "app_authorized", storeExternalId: "55", credentials: { accessToken: "a", refreshToken: "r" } });
    const order = parseSallaWebhook({ event: "order.created", merchant: 55, data: { id: 9, amounts: { total: { amount: 99.5, currency: "SAR" } }, status: { slug: "under_review" }, items: [{ product: { id: 123 } }] } });
    expect(order).toMatchObject({ type: "order", order: { externalOrderId: "9", total: 99.5, productExternalIds: ["123"] } });
  });
});

describe("zid", () => {
  it("maps a product and builds a url from the slug", () => {
    const p = mapZidProduct({ id: "z1", name: { ar: "قميص", en: "Shirt" }, slug: "shirt", price: "120.00", quantity: 0, is_infinite: false }, store("zid"))!;
    expect(p).toMatchObject({ title: "قميص", url: "https://shop.example.com/products/shirt", price: 120, availability: "out_of_stock" });
  });
  it("verifies our target-url token", () => {
    const params = new URLSearchParams({ store: "77", event: "order.create", token: zidWebhookToken("sec", "77", "order.create") });
    expect(verifyZidWebhook(params, "sec")).toBe(true);
    params.set("event", "product.delete");
    expect(verifyZidWebhook(params, "sec")).toBe(false);
  });
  it("parses an order", () => {
    expect(parseZidWebhook("order.create", "77", { id: 5, order_total: "300", currency_code: "SAR", products: [{ id: "z1" }] })).toMatchObject({
      type: "order", order: { externalOrderId: "5", total: 300, productExternalIds: ["z1"] },
    });
  });
});

describe("woocommerce", () => {
  it("maps a product with a sale", () => {
    const p = mapWooProduct({ id: 7, name: "Hoodie", permalink: "https://shop.example.com/product/hoodie", price: "80", regular_price: "100", sale_price: "80", stock_status: "instock", status: "publish", attributes: [{ name: "Size", options: ["M", "L"] }] }, store("woocommerce"))!;
    expect(p).toMatchObject({ price: 100, salePrice: 80, attributes: { Size: "M, L" } });
  });
  it("builds a cart url", () => {
    const t = wooConnector.cartTarget(store("woocommerce"), { externalId: "7" } as Product, undefined, 3);
    expect(t.kind).toBe("cart");
    expect(t.url).toBe("https://shop.example.com/cart/?add-to-cart=7&quantity=3");
  });
  it("verifies base64 signatures and reads the ref meta", () => {
    const body = "{}";
    expect(verifyWooWebhook(body, hmacSha256("s", body, "base64"), "s")).toBe(true);
    const ev = parseWooWebhook("order.created", "https://shop.example.com", { id: 1, total: "50.00", currency: "EGP", line_items: [{ product_id: 7 }], meta_data: [{ key: "_wasl_ref", value: "abc" }] });
    expect(ev).toMatchObject({ type: "order", order: { ref: "abc", total: 50, productExternalIds: ["7"] } });
  });
});
