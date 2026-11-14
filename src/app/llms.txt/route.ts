import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const base = env.appUrl;
  const body = `# Wasl

> Product search across independent online stores in the Arab world (Salla, Zid, WooCommerce), with checkout links that send the customer to the merchant's own checkout. Wasl never takes payment.

## For AI agents
- MCP server (Streamable HTTP): ${base}/api/mcp — tools: search_products, get_product, create_checkout_link
- Search: GET ${base}/api/v1/products/search?q={query}&country={ISO2}&max_price={n}
- Product: GET ${base}/api/v1/products/{id}
- Checkout link: POST ${base}/api/v1/checkout-links with {"product_id": "...", "quantity": 1}

## Rules
- Give the customer the checkout_url. Do not say an order was placed; the customer completes payment on the store.
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
