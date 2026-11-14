import { json, preflight } from "@/lib/http";
import { getProductWithStore, publicProduct } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await getProductWithStore(id.slice(0, 64));
  if (!found) return json({ error: "Product not found" }, 404);
  return json(publicProduct(found.product, found.store));
}

export const OPTIONS = preflight;
