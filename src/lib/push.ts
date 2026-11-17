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

/* ---------- Alert rules ---------- */

export type RuleType = "price_above" | "price_below" | "index_below" | "index_above" | "inflow_above" | "foundation" | "inflow_spike";
export interface Rule {
  type: RuleType;
  value?: number;
}
export const RULE_TYPES: RuleType[] = ["price_above", "price_below", "index_below", "index_above", "inflow_above", "foundation", "inflow_spike"];
const NEEDS_VALUE: RuleType[] = ["price_above", "price_below", "index_below", "index_above", "inflow_above"];

export function cleanRules(raw: unknown): Rule[] {
  if (!Array.isArray(raw)) return [];
  const out: Rule[] = [];
  for (const r of raw.slice(0, 10)) {
    const type = (r as Rule)?.type;
    if (!RULE_TYPES.includes(type)) continue;
    const value = Number((r as Rule).value);
    if (NEEDS_VALUE.includes(type) && !(Number.isFinite(value) && value > 0)) continue;
    out.push(NEEDS_VALUE.includes(type) ? { type, value } : { type });
  }
  return out;
}

const COOLDOWN_MS = 6 * 3_600_000;
const ruleKey = (r: Rule) => `${r.type}:${r.value ?? ""}`;

interface RuleSub {
  endpoint: string;
  p256dh: string;
  auth: string;
  rules: Rule[];
  rule_state: Record<string, string>;
}

/**
 * Sends notifications for threshold rules (price, index, 24h exchange inflow) with a 6-hour
 * cooldown per rule, and for new foundation-movement / inflow-spike alerts.
 */
export async function checkRules(sql: Sql, net: Network) {
  if (!pushConfigured() || net !== "mainnet") return { sent: 0 };
  setup();
  const subs = await sql<RuleSub[]>`select endpoint, p256dh, auth, rules, rule_state from push_subscriptions where net = ${net} and jsonb_array_length(rules) > 0 limit 1000`;
  const fresh = await sql<{ id: string; kind: string; amount: string | null; meta: Record<string, unknown>; to_acc: string | null; from_acc: string | null }[]>`
    select id, kind, amount::text, meta, to_acc, from_acc from alerts where net = ${net} and not pushed and at > now() - interval '3 hours' order by at limit 20`;
  if (!subs.length) {
    if (fresh.length) await sql`update alerts set pushed = true where net = ${net} and id = any(${fresh.map((a) => a.id)})`;
    return { sent: 0, subscriptions: 0 };
  }
  const [sig] = await sql<{ price: string | null; score: string | null }[]>`select price::text, score::text from signals_hourly where net = ${net} order by hour desc limit 1`;
  const [flow] = await sql<{ net: string }[]>`select coalesce(sum(exch_in - exch_out), 0)::text as net from flows_hourly where net = ${net} and hour >= now() - interval '24 hours'`;
  const price = sig?.price ? Number(sig.price) : null;
  const score = sig?.score ? Number(sig.score) : null;
  const inflow = Number(flow?.net ?? 0);
  const fmt = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 4 });

  let sent = 0;
  for (const s of subs) {
    const state = { ...s.rule_state };
    const messages: { key: string; title: string; body: string; url: string }[] = [];
    for (const r of s.rules) {
      const key = ruleKey(r);
      const due = !state[key] || Date.now() - Date.parse(state[key]) > COOLDOWN_MS;
      if (!due) continue;
      const v = r.value ?? 0;
      if (r.type === "price_above" && price !== null && price >= v) messages.push({ key, title: "PI price alert", body: `PI is ${fmt(price)} USDT (above ${fmt(v)})`, url: "/" });
      if (r.type === "price_below" && price !== null && price <= v) messages.push({ key, title: "PI price alert", body: `PI is ${fmt(price)} USDT (below ${fmt(v)})`, url: "/" });
      if (r.type === "index_below" && score !== null && score <= v) messages.push({ key, title: "Pressure index alert", body: `Pi Pressure Index is ${score} (at or below ${v})`, url: "/pressure" });
      if (r.type === "index_above" && score !== null && score >= v) messages.push({ key, title: "Pressure index alert", body: `Pi Pressure Index is ${score} (at or above ${v})`, url: "/pressure" });
      if (r.type === "inflow_above" && inflow >= v) messages.push({ key, title: "Exchange inflow alert", body: `${fmt(Math.round(inflow))} Pi net into exchanges in 24h`, url: "/flows" });
    }
    for (const a of fresh) {
      if (!s.rules.some((r) => r.type === a.kind)) continue;
      const amount = a.amount ? `${fmt(Math.round(Number(a.amount)))} Pi` : "";
      if (a.kind === "foundation") messages.push({ key: `alert:${a.id}`, title: "Foundation wallet moved Pi", body: `${amount} → ${a.meta?.dest ?? "unknown"}`, url: "/radar" });
      if (a.kind === "inflow_spike") messages.push({ key: `alert:${a.id}`, title: "Unusual exchange inflow", body: `${amount} in one hour (${a.meta?.z ?? "?"}× normal spread)`, url: "/alerts" });
    }
    for (const m of messages.slice(0, 5)) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(m), { TTL: 3600 });
        sent++;
        if (!m.key.startsWith("alert:")) state[m.key] = new Date().toISOString();
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await sql`delete from push_subscriptions where endpoint = ${s.endpoint}`;
          break;
        }
      }
    }
    if (messages.length) await sql`update push_subscriptions set rule_state = ${sql.json(state)} where endpoint = ${s.endpoint}`;
  }
  if (fresh.length) await sql`update alerts set pushed = true where net = ${net} and id = any(${fresh.map((a) => a.id)})`;
  return { sent, subscriptions: subs.length };
}
