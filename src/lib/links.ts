import { env } from "./env";
import { hmacSha256, randomId, safeEqual } from "./crypto";

/**
 * A checkout link is self-contained and signed, so the redirect keeps working even
 * if the database is briefly unavailable. The customer pays on the merchant's site;
 * Wasl never touches the money.
 */
export interface LinkPayload {
  /** Link id; also sent to the store as `wasl_ref` for attribution. */
  id: string;
  storeId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  /** The merchant URL the customer lands on (cart or product page). */
  destination: string;
  /** Which agent asked for the link, if it said so (e.g. "claude", "chatgpt"). */
  agent?: string;
  /** Expiry, unix seconds. */
  exp: number;
}

const SIG_BYTES = 16;

function sign(body: string): string {
  return hmacSha256(env.linkSecret, body, "base64url").slice(0, Math.ceil((SIG_BYTES * 4) / 3));
}

export interface CreateLinkInput {
  storeId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  /** Merchant cart or product URL, before tracking parameters are added. */
  baseUrl: string;
  agent?: string;
  ttlSeconds?: number;
}

export function createLinkToken(input: CreateLinkInput): { token: string; payload: LinkPayload } {
  const id = randomId(9);
  const payload: LinkPayload = {
    id,
    storeId: input.storeId,
    productId: input.productId,
    ...(input.variantId ? { variantId: input.variantId } : {}),
    quantity: input.quantity,
    destination: withTracking(input.baseUrl, id, input.agent),
    ...(input.agent ? { agent: input.agent } : {}),
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? env.linkTtlSeconds),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${body}.${sign(body)}`, payload };
}

export type VerifyResult = { ok: true; payload: LinkPayload } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyLinkToken(token: string, now = Date.now()): VerifyResult {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "malformed" };
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(body))) return { ok: false, reason: "bad_signature" };
  let payload: LinkPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < now) return { ok: false, reason: "expired" };
  if (!/^https?:\/\//.test(payload.destination)) return { ok: false, reason: "malformed" };
  return { ok: true, payload };
}

export function linkUrl(token: string): string {
  return `${env.appUrl}/c/${token}`;
}

/** Adds the tracking parameters every destination carries. */
export function withTracking(url: string, linkId: string, agent?: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "wasl");
  u.searchParams.set("utm_medium", "ai_agent");
  if (agent) u.searchParams.set("utm_campaign", agent.slice(0, 40));
  u.searchParams.set("wasl_ref", linkId);
  return u.toString();
}
