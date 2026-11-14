/** Small, defensive helpers for mapping third-party payloads whose exact shape we cannot fully trust. */

export function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    // Localised fields such as { ar: "...", en: "..." }
    const o = v as Record<string, unknown>;
    return str(o.ar ?? o.en ?? Object.values(o)[0]);
  }
  return "";
}

export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return num(o.amount ?? o.value);
  }
  return null;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function absoluteUrl(base: string, maybeRelative: string): string {
  if (!maybeRelative) return base;
  try {
    return new URL(maybeRelative, base.endsWith("/") ? base : `${base}/`).toString();
  } catch {
    return base;
  }
}

export async function getJson(fetchImpl: (u: string, i?: RequestInit) => Promise<Response>, url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetchImpl(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}
