import { getRepo } from "@/lib/db";
import { json, isCronAuthorized } from "@/lib/http";
import { syncStore } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily full sync of every active store (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return json({ error: "unauthorized" }, 401);
  const repo = await getRepo();
  const results = [];
  for (const store of await repo.listActiveStores()) {
    if (store.externalId.startsWith("demo-")) continue;
    try {
      results.push(await syncStore(store, repo));
    } catch (e) {
      results.push({ storeId: store.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return json({ stores: results.length, results });
}
