import webpush from "web-push";
import { knownWallet } from "../data/wallets";
import type { Sql } from "./db";
import { shortId } from "./format";
import { horizonHost, type Network, type Operation } from "./horizon";

export function pushConfigured() {
  return !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

function setup() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://ai-site-builder-peach.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  addresses: string[];
  last_seen: Record<string, string>;
}

async function latestOp(net: Network, account: string): Promise<Operation | null> {
  try {
    const res = await fetch(`${horizonHost(net)}/accounts/${account}/operations?order=desc&limit=1`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { _embedded: { records: Operation[] } };
    return body._embedded.records[0] ?? null;
  } catch {
    return null;
  }
}

function describe(op: Operation) {
  const amount = (op.amount ?? op.starting_balance) as string | undefined;
  const pretty = amount ? `${Number(amount).toLocaleString("en", { maximumFractionDigits: 2 })} Pi` : "";
  const type = op.type.replace(/_/g, " ");
  return pretty ? `${type}: ${pretty}` : type;
}

/**
 * For every push subscription, checks the newest operation of each watched account and sends a
 * notification when it changed since the last check. The first check only records a baseline.
 */
export async function checkWatchlists(sql: Sql, net: Network, deadline: number) {
  if (!pushConfigured() || net !== "mainnet") return { sent: 0 };
  setup();
  const subs = await sql<SubRow[]>`select endpoint, p256dh, auth, addresses, last_seen from push_subscriptions where net = ${net} limit 500`;
  const addresses = [...new Set(subs.flatMap((s) => s.addresses))].slice(0, 300);
  const latest = new Map<string, Operation | null>();
  for (let i = 0; i < addresses.length && Date.now() < deadline - 3000; i += 10) {
    const batch = addresses.slice(i, i + 10);
    const ops = await Promise.all(batch.map((a) => latestOp(net, a)));
    batch.forEach((a, j) => latest.set(a, ops[j]));
  }
  let sent = 0;
  for (const s of subs) {
    const seen = { ...s.last_seen };
    let changed = false;
    for (const a of s.addresses) {
      const op = latest.get(a);
      if (!op) continue;
      if (seen[a] && seen[a] !== op.id) {
        const name = knownWallet(a)?.label.split(" · ")[0] ?? shortId(a, 4, 4);
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: `Blockchain Pi · ${name}`, body: describe(op), url: `/account/${a}` }),
            { TTL: 3600 },
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await sql`delete from push_subscriptions where endpoint = ${s.endpoint}`;
            break;
          }
        }
      }
      if (seen[a] !== op.id) {
        seen[a] = op.id;
        changed = true;
      }
    }
    if (changed) await sql`update push_subscriptions set last_seen = ${sql.json(seen)} where endpoint = ${s.endpoint}`;
  }
  return { sent, subscriptions: subs.length, addresses: addresses.length };
}
