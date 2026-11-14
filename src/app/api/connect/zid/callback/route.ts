import { after } from "next/server";
import { getRepo } from "@/lib/db";
import { env } from "@/lib/env";
import { json, verifyState } from "@/lib/http";
import { exchangeZidCode } from "@/lib/connectors/zid";
import { finishZidConnection, registerZidWebhooks } from "@/lib/onboarding";
import { syncStore } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (!verifyState(p.get("state"))) return json({ error: "invalid state" }, 400);
  const code = p.get("code");
  if (!code) return json({ error: "missing code" }, 400);
  if (!env.zidClientId || !env.zidClientSecret) return json({ error: "Zid app is not configured" }, 500);

  const creds = await exchangeZidCode(code, { clientId: env.zidClientId, clientSecret: env.zidClientSecret, redirectUri: `${env.appUrl}/api/connect/zid/callback` });
  const repo = await getRepo();
  const store = await finishZidConnection(repo, creds);
  after(async () => {
    await registerZidWebhooks(store, creds).catch((e) => console.error("zid webhooks failed", e));
    await syncStore(store, repo).catch((e) => console.error("zid first sync failed", e));
  });
  return Response.redirect(`${env.appUrl}/connected?platform=zid`, 302);
}
