import { json, preflight } from "@/lib/http";
import { searchProducts } from "@/lib/services";

export const dynamic = "force-dynamic";

function numParam(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** GET /api/v1/products/search?q=عطر&country=SA&max_price=300&limit=10 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const q = (p.get("q") ?? "").trim().slice(0, 200);
  if (!q) return json({ error: "q is required" }, 400);
  const country = p.get("country")?.toUpperCase();
  const currency = p.get("currency")?.toUpperCase();
  const results = await searchProducts({
    query: q,
    country: country && /^[A-Z]{2}$/.test(country) ? country : undefined,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined,
    maxPrice: numParam(p.get("max_price")),
    minPrice: numParam(p.get("min_price")),
    limit: Math.min(numParam(p.get("limit")) ?? 10, 25),
  });
  return json({ count: results.length, results });
}

export const OPTIONS = preflight;
