import { json, signState } from "@/lib/http";
import { normalizeSite, wooAuthorizeUrl } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/** GET /api/connect/woocommerce?site=https://mystore.com → sends the merchant to their own WooCommerce approval screen. */
export function GET(req: Request) {
  const site = normalizeSite(new URL(req.url).searchParams.get("site") ?? "");
  if (!site) return json({ error: "site must be an https URL" }, 400);
  return Response.redirect(wooAuthorizeUrl(site, signState({ site })), 302);
}
