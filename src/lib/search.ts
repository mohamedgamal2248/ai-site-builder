import type { Product, ProductSearch } from "./types";

/** Normalises Arabic and Latin text so "أحمر", "احمر" and "AHMAR " compare sensibly. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // harakat + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["the", "a", "an", "for", "and", "or", "of", "in", "with", "في", "من", "على", "عن", "مع", "او", "و", "ال", "الى", "لل"]);

export function tokens(query: string): string[] {
  return normalize(query)
    .split(" ")
    .map((t) => (t.length > 3 && t.startsWith("ال") ? t.slice(2) : t))
    .filter((t) => t.length > 1 && !STOP.has(t))
    .slice(0, 12);
}

export function effectivePrice(p: Pick<Product, "price" | "salePrice">): number {
  return p.salePrice && p.salePrice > 0 ? p.salePrice : p.price;
}

/** Simple relevance score: title hits weigh most, then category/brand, then description. */
export function score(product: Product, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 1;
  const title = normalize(product.title);
  const meta = normalize(`${product.category ?? ""} ${product.brand ?? ""} ${Object.values(product.attributes).join(" ")}`);
  const desc = normalize(product.description).slice(0, 2000);
  let s = 0;
  let matched = 0;
  for (const t of queryTokens) {
    let hit = false;
    if (title.includes(t)) { s += 5; hit = true; }
    if (meta.includes(t)) { s += 2; hit = true; }
    if (desc.includes(t)) { s += 1; hit = true; }
    if (hit) matched++;
  }
  if (matched === 0) return 0;
  // Reward covering more of the query.
  return s * (matched / queryTokens.length);
}

export function passesFilters(p: Product, f: ProductSearch): boolean {
  const price = effectivePrice(p);
  if (f.inStockOnly !== false && p.availability !== "in_stock") return false;
  if (f.maxPrice != null && price > f.maxPrice) return false;
  if (f.minPrice != null && price < f.minPrice) return false;
  if (f.currency && p.currency.toUpperCase() !== f.currency.toUpperCase()) return false;
  return true;
}
