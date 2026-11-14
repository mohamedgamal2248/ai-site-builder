import { getRepo } from "@/lib/db";
import { verifyLinkToken } from "@/lib/links";

export const dynamic = "force-dynamic";

/** The checkout link the customer opens: records the click, then sends them to the merchant. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const v = verifyLinkToken(token);
  if (!v.ok) {
    const msg = v.reason === "expired" ? "انتهت صلاحية هذا الرابط. اطلب رابطاً جديداً. / This link has expired." : "رابط غير صالح. / Invalid link.";
    return new Response(msg, { status: v.reason === "expired" ? 410 : 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const { payload } = v;
  try {
    const repo = await getRepo();
    await repo.recordClick({ linkId: payload.id, storeId: payload.storeId, productId: payload.productId, agent: payload.agent ?? null, createdAt: new Date().toISOString() });
  } catch (e) {
    // Never block the customer because analytics failed.
    console.error("click record failed", e);
  }
  return new Response(null, { status: 302, headers: { Location: payload.destination, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer-when-downgrade" } });
}
