import { env } from "./env";
import { hmacSha256, safeEqual } from "./crypto";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Protocol-Version",
};

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS_HEADERS, ...extra },
  });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Signs short-lived OAuth `state` values so callbacks can trust what we put in them. */
export function signState(data: Record<string, string>, ttlSeconds = 900): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${body}.${hmacSha256(env.linkSecret, `state:${body}`, "base64url")}`;
}

export function verifyState(state: string | null): Record<string, string> | null {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig || !safeEqual(sig, hmacSha256(env.linkSecret, `state:${body}`, "base64url"))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp * 1000 < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function isCronAuthorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  return safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`);
}
