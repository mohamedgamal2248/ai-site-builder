import { after } from "next/server";
import { getRepo } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { parseSallaWebhook, SALLA_API, verifySallaWebhook } from "@/lib/connectors/salla";
import { getJson, obj, str } from "@/lib/connectors/util";
import { handleWebhookEvent, syncStore } from "@/lib/services";

export const dynamic = "force-dynamic";

/** Salla app webhook (Easy Mode). Set this URL and the webhook secret in the Salla Partners portal. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySallaWebhook(raw, req.headers.get("x-salla-signature"), env.sallaWebhookSecret)) {
    return json({ error: "invalid signature" }, 401);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const ev = parseSallaWebhook(body);
  const repo = await getRepo();

  // First install: create the store from Salla's store info before saving tokens.
  if (ev.type === "app_authorized" && !(await repo.findStore("salla", ev.storeExternalId))) {
    const info = obj(obj(await getJson(fetch, `${SALLA_API}/store/info`, { Authorization: `Bearer ${ev.credentials.accessToken}` })).data);
    await repo.upsertStore({
      platform: "salla",
      externalId: ev.storeExternalId,
      name: str(info.name) || `Salla store ${ev.storeExternalId}`,
      domain: (str(info.domain) || str(info.url)).replace(/\/$/, ""),
      currency: str(info.currency) || "SAR",
      shipsTo: ["SA"],
      status: "active",
      plan: "free",
    });
  }

  const result = await handleWebhookEvent("salla", ev, repo);

  if (ev.type !== "ignored" && (ev.type === "app_authorized" || ("resync" in result && result.resync))) {
    const store = await repo.findStore("salla", ev.storeExternalId);
    if (store) after(() => syncStore(store).catch((e) => console.error("salla sync failed", e)));
  }
  return json(result);
}
