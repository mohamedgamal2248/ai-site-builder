/**
 * A minimal, stateless MCP server (Streamable HTTP transport, JSON responses only).
 * Supports: initialize, notifications/initialized, ping, tools/list, tools/call.
 * Spec: https://modelcontextprotocol.io/specification
 */
import { z } from "zod";
import { CheckoutError, createCheckoutLink, getProductWithStore, publicProduct, searchProducts } from "./services";

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const SERVER_INFO = { name: "wasl", title: "Wasl — Arab stores for AI agents", version: "0.1.0" };

const INSTRUCTIONS =
  "Search products from independent online stores in the Arab world (Salla, Zid, WooCommerce). " +
  "To buy, call create_checkout_link and give the customer the returned URL: they review and pay on the store's own " +
  "checkout (cards, Apple Pay, Mada, BNPL or cash on delivery, depending on the store). Never claim an order is placed.";

type Json = Record<string, unknown>;
interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Json;
}

const searchInput = z.object({
  query: z.string().min(1).max(200),
  country: z.string().length(2).optional(),
  max_price: z.number().positive().optional(),
  min_price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});
const getInput = z.object({ product_id: z.string().min(1).max(64) });
const checkoutInput = z.object({
  product_id: z.string().min(1).max(64),
  variant_id: z.string().max(64).optional(),
  quantity: z.number().int().min(1).max(20).optional(),
  agent_name: z.string().max(40).optional(),
});

export const TOOLS = [
  {
    name: "search_products",
    title: "Search products",
    description:
      "Search in-stock products across connected stores. Works with Arabic or English queries. " +
      "Use `country` (ISO code like SA, AE, EG) to keep only stores that ship there.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the customer wants, e.g. 'عطر عود' or 'black hoodie size L'" },
        country: { type: "string", description: "ISO 3166-1 alpha-2 delivery country" },
        max_price: { type: "number" },
        min_price: { type: "number" },
        currency: { type: "string", description: "ISO 4217, e.g. SAR, AED, EGP" },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 10 },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_product",
    title: "Get product details",
    description: "Full details for one product id returned by search_products, including variants.",
    inputSchema: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "create_checkout_link",
    title: "Create checkout link",
    description:
      "Create a link that takes the customer to the store to pay. Payment always happens on the merchant's site; " +
      "this does not place or pay for an order. Show the link to the customer.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        variant_id: { type: "string", description: "Variant id from get_product, when the product has variants" },
        quantity: { type: "integer", minimum: 1, maximum: 20, default: 1 },
        agent_name: { type: "string", description: "Your product name, e.g. 'claude' (used for merchant analytics)" },
      },
      required: ["product_id"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
] as const;

function ok(id: RpcRequest["id"], result: Json) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}
function err(id: RpcRequest["id"], code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function toolResult(data: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: (Array.isArray(data) ? { results: data } : data) as Json,
    isError,
  };
}

async function callTool(name: string, args: unknown) {
  switch (name) {
    case "search_products": {
      const a = searchInput.parse(args ?? {});
      const results = await searchProducts({
        query: a.query,
        country: a.country,
        maxPrice: a.max_price,
        minPrice: a.min_price,
        currency: a.currency,
        limit: a.limit ?? 10,
      });
      return toolResult({ count: results.length, results });
    }
    case "get_product": {
      const a = getInput.parse(args ?? {});
      const found = await getProductWithStore(a.product_id);
      if (!found) return toolResult({ error: "Product not found" }, true);
      return toolResult(publicProduct(found.product, found.store));
    }
    case "create_checkout_link": {
      const a = checkoutInput.parse(args ?? {});
      try {
        return toolResult(await createCheckoutLink({ productId: a.product_id, variantId: a.variant_id, quantity: a.quantity, agent: a.agent_name }));
      } catch (e) {
        if (e instanceof CheckoutError) return toolResult({ error: e.message, code: e.code }, true);
        throw e;
      }
    }
    default:
      return null;
  }
}

/** Handles one JSON-RPC message. Returns null for notifications (no response body). */
export async function handleRpc(msg: unknown) {
  const m = msg as RpcRequest;
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return err(null, -32600, "Invalid Request");
  const isNotification = m.id === undefined;

  try {
    switch (m.method) {
      case "initialize": {
        const requested = String(m.params?.protocolVersion ?? "");
        const version = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
        return ok(m.id, { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
      }
      case "notifications/initialized":
      case "notifications/cancelled":
        return null;
      case "ping":
        return ok(m.id, {});
      case "tools/list":
        return ok(m.id, { tools: TOOLS as unknown as Json[] });
      case "tools/call": {
        const name = String(m.params?.name ?? "");
        const result = await callTool(name, m.params?.arguments);
        if (!result) return err(m.id, -32602, `Unknown tool: ${name}`);
        return ok(m.id, result as unknown as Json);
      }
      default:
        return isNotification ? null : err(m.id, -32601, `Method not found: ${m.method}`);
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      // Input problems are reported as tool errors so the model can correct itself.
      if (m.method === "tools/call") return ok(m.id, toolResult({ error: "Invalid arguments", issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, true) as unknown as Json);
      return err(m.id, -32602, "Invalid params");
    }
    console.error("MCP error", e);
    return err(m.id, -32603, "Internal error");
  }
}
