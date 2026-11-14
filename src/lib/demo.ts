import type { Repository } from "./db/types";
import type { NewProduct } from "./types";

/** Fictional demo stores so the MCP server and API return something before any merchant connects. */
export async function seedDemo(repo: Repository): Promise<void> {
  const perfume = await repo.upsertStore({
    platform: "salla",
    externalId: "demo-salla-1",
    name: "متجر عطور تجريبي (Demo)",
    domain: "https://demo-perfume.example.com",
    currency: "SAR",
    shipsTo: ["SA", "AE", "KW"],
    status: "active",
    plan: "growth",
  });
  const fashion = await repo.upsertStore({
    platform: "woocommerce",
    externalId: "https://demo-fashion.example.com",
    name: "Demo Fashion Store",
    domain: "https://demo-fashion.example.com",
    currency: "EGP",
    shipsTo: ["EG"],
    status: "active",
    plan: "free",
  });

  const p = (o: Partial<NewProduct> & Pick<NewProduct, "storeId" | "externalId" | "title" | "price" | "currency" | "url">): NewProduct => ({
    description: "",
    availability: "in_stock",
    attributes: {},
    variants: [],
    ...o,
  });

  await repo.upsertProducts(perfume.id, [
    p({ storeId: perfume.id, externalId: "101", title: "عطر عود ملكي 100 مل", description: "عطر شرقي بخلاصة العود الكمبودي، ثبات عالٍ.", category: "عطور", brand: "Demo Oud", price: 349, salePrice: 279, currency: "SAR", url: "https://demo-perfume.example.com/p101" }),
    p({ storeId: perfume.id, externalId: "102", title: "دهن عود فاخر 12 مل", description: "دهن عود طبيعي للمناسبات.", category: "عطور", brand: "Demo Oud", price: 520, currency: "SAR", url: "https://demo-perfume.example.com/p102" }),
    p({ storeId: perfume.id, externalId: "103", title: "معطر مفارش بالمسك", description: "رذاذ للمفارش برائحة المسك الأبيض.", category: "معطرات", price: 45, currency: "SAR", url: "https://demo-perfume.example.com/p103", availability: "out_of_stock" }),
  ]);
  await repo.upsertProducts(fashion.id, [
    p({ storeId: fashion.id, externalId: "501", title: "Cotton Hoodie - Black", description: "Egyptian cotton hoodie, unisex fit.", category: "Hoodies", price: 899, currency: "EGP", url: "https://demo-fashion.example.com/product/cotton-hoodie", attributes: { Size: "S, M, L, XL" } }),
    p({ storeId: fashion.id, externalId: "502", title: "تيشيرت قطن أبيض", description: "تيشيرت قطن مصري 100%.", category: "تيشيرتات", price: 349, salePrice: 299, currency: "EGP", url: "https://demo-fashion.example.com/product/white-tee", attributes: { المقاس: "M, L, XL" } }),
  ]);
}
