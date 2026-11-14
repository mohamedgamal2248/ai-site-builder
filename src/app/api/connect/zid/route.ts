import { env } from "@/lib/env";
import { json, signState } from "@/lib/http";
import { zidAuthorizeUrl } from "@/lib/connectors/zid";

export const dynamic = "force-dynamic";

/** Starts the Zid OAuth flow. Set the redirect URL in the Zid Partner Dashboard to {APP_URL}/api/connect/zid/callback. */
export function GET() {
  if (!env.zidClientId) return json({ error: "ZID_CLIENT_ID is not set" }, 500);
  return Response.redirect(zidAuthorizeUrl(env.zidClientId, `${env.appUrl}/api/connect/zid/callback`, signState({ p: "zid" })), 302);
}
