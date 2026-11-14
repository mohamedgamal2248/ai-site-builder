import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "@/lib/db/memory";
import { setRepoForTests } from "@/lib/db";
import { seedDemo } from "@/lib/demo";
import { verifyLinkToken } from "@/lib/links";
import { handleRpc } from "@/lib/mcp";
import { handleWebhookEvent } from "@/lib/services";
import { GET as redirect } from "@/app/c/[token]/route";

let repo: MemoryRepository;

beforeEach(async () => {
  repo = new MemoryRepository();
  await seedDemo(repo);
  setRepoForTests(repo);
});

async function call(name: string, args: Record<string, unknown>) {
  const res = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })) as any;
  return res.result;
}

describe("MCP server", () => {
  it("initializes and lists tools", async () => {
    const init = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } })) as any;
    expect(init.result.protocolVersion).toBe("2025-06-18");
    expect(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    const list = (await handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" })) as any;
    expect(list.result.tools.map((t: any) => t.name)).toEqual(["search_products", "get_product", "create_checkout_link"]);
  });

  it("falls back to the latest protocol version for unknown ones", async () => {
    const init = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } })) as any;
    expect(init.result.protocolVersion).toBe("2025-11-25");
  });

  it("searches in Arabic with country and price filters, hiding out-of-stock items", async () => {
    const r = await call("search_products", { query: "عطور عود", country: "SA" });
    const titles = r.structuredContent.results.map((x: any) => x.title);
    expect(titles[0]).toContain("عود");
    expect(titles).not.toContain("معطر مفارش بالمسك");
    const cheap = await call("search_products", { query: "عود", max_price: 300 });
    expect(cheap.structuredContent.results.map((x: any) => x.price)).toEqual([279]);
    const egypt = await call("search_products", { query: "عود", country: "EG" });
    expect(egypt.structuredContent.count).toBe(0);
  });

  it("reports bad arguments as a tool error", async () => {
    const r = await call("search_products", { query: "" });
    expect(r.isError).toBe(true);
  });

  it("returns unknown methods as JSON-RPC errors", async () => {
    const r = (await handleRpc({ jsonrpc: "2.0", id: 9, method: "resources/list" })) as any;
    expect(r.error.code).toBe(-32601);
  });
});

describe("buy flow: link → click → order attribution", () => {
  it("woocommerce item lands in the cart and the order is attributed exactly", async () => {
    const found = await call("search_products", { query: "hoodie", country: "EG" });
    const product = found.structuredContent.results[0];
    const link = await call("create_checkout_link", { product_id: product.id, quantity: 2, agent_name: "claude" });
    expect(link.isError).toBe(false);
    expect(link.structuredContent.lands_on).toBe("cart");
    expect(link.structuredContent.estimated_total).toBe(1798);

    const token = new URL(link.structuredContent.checkout_url).pathname.split("/").pop()!;
    const res = await redirect(new Request("http://x"), { params: Promise.resolve({ token }) });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("add-to-cart")).toBe("501");
    expect(location.searchParams.get("quantity")).toBe("2");

    const ref = location.searchParams.get("wasl_ref")!;
    const out = await handleWebhookEvent("woocommerce", {
      type: "order", storeExternalId: "https://demo-fashion.example.com",
      order: { externalOrderId: "o1", total: 1798, currency: "EGP", status: "processing", productExternalIds: ["501"], ref },
    });
    expect(out).toMatchObject({ handled: true, attribution: "exact" });
    const store = await repo.findStore("woocommerce", "https://demo-fashion.example.com");
    expect(await repo.stats(store!.id)).toMatchObject({ clicks: 1, orders: 1, attributedRevenue: 1798 });
  });

  it("salla link lands on the product page and the order is attributed as probable", async () => {
    const found = await call("search_products", { query: "دهن عود" });
    const product = found.structuredContent.results[0];
    const link = await call("create_checkout_link", { product_id: product.id });
    expect(link.structuredContent.lands_on).toBe("product_page");
    const token = new URL(link.structuredContent.checkout_url).pathname.split("/").pop()!;
    expect(verifyLinkToken(token).ok).toBe(true);
    await redirect(new Request("http://x"), { params: Promise.resolve({ token }) });

    const out = await handleWebhookEvent("salla", {
      type: "order", storeExternalId: "demo-salla-1",
      order: { externalOrderId: "9", total: 520, currency: "SAR", status: "new", productExternalIds: ["102"], ref: null },
    });
    expect(out).toMatchObject({ attribution: "probable" });
  });

  it("orders with no matching click are recorded as unattributed", async () => {
    const out = await handleWebhookEvent("salla", {
      type: "order", storeExternalId: "demo-salla-1",
      order: { externalOrderId: "10", total: 10, currency: "SAR", status: "new", productExternalIds: ["101"], ref: "forged" },
    });
    expect(out).toMatchObject({ attribution: "none" });
  });

  it("refuses links for out-of-stock products", async () => {
    const store = await repo.findStore("salla", "demo-salla-1");
    const all = await repo.search({ query: "مسك", inStockOnly: false });
    const musk = all.find((r) => r.store.id === store!.id)!;
    const link = await call("create_checkout_link", { product_id: musk.product.id });
    expect(link.isError).toBe(true);
    expect(link.structuredContent.code).toBe("out_of_stock");
  });
});
