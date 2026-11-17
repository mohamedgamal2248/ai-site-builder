import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { cleanRules } from "@/lib/push";

export const dynamic = "force-dynamic";

interface Body {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  addresses?: string[];
  rules?: unknown;
  net?: string;
  unsubscribe?: boolean;
}

/** Saves (or removes) a browser push subscription and the accounts it watches. */
export async function POST(req: NextRequest) {
  const sql = getDb();
  if (!sql) return NextResponse.json({ error: "not configured" }, { status: 503 });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const endpoint = body.subscription?.endpoint ?? "";
  if (!/^https:\/\/[^\s]{10,500}$/.test(endpoint)) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  if (body.unsubscribe) {
    await sql`delete from push_subscriptions where endpoint = ${endpoint}`;
    return NextResponse.json({ ok: true });
  }
  const p256dh = body.subscription?.keys?.p256dh ?? "";
  const auth = body.subscription?.keys?.auth ?? "";
  if (!p256dh || !auth || p256dh.length > 200 || auth.length > 100) return NextResponse.json({ error: "bad keys" }, { status: 400 });
  const addresses = [...new Set((body.addresses ?? []).filter((a) => /^G[A-Z2-7]{55}$/.test(a)))].slice(0, 25);
  const net = body.net === "testnet" ? "testnet" : "mainnet";
  await sql`
    insert into push_subscriptions (endpoint, p256dh, auth, net, addresses)
    values (${endpoint}, ${p256dh}, ${auth}, ${net}, ${addresses})
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, net = excluded.net, addresses = excluded.addresses`;
  // Rules are only replaced when the client sends them, so the watchlist sync does not wipe them.
  if (body.rules !== undefined) {
    const rules = cleanRules(body.rules);
    await sql`update push_subscriptions set rules = ${sql.json(rules as never)} where endpoint = ${endpoint}`;
  }
  return NextResponse.json({ ok: true, watching: addresses.length });
}
