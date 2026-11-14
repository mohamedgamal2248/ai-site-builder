import { z } from "zod";
import { json, preflight } from "@/lib/http";
import { CheckoutError, createCheckoutLink } from "@/lib/services";

export const dynamic = "force-dynamic";

const body = z.object({
  product_id: z.string().min(1).max(64),
  variant_id: z.string().max(64).optional(),
  quantity: z.number().int().min(1).max(20).optional(),
  agent_name: z.string().max(40).optional(),
});

/** POST /api/v1/checkout-links  {"product_id": "...", "quantity": 1} */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid body", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
  try {
    const d = parsed.data;
    return json(await createCheckoutLink({ productId: d.product_id, variantId: d.variant_id, quantity: d.quantity, agent: d.agent_name }), 201);
  } catch (e) {
    if (e instanceof CheckoutError) return json({ error: e.message, code: e.code }, e.code === "not_found" ? 404 : 409);
    throw e;
  }
}

export const OPTIONS = preflight;
