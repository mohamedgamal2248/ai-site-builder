import type { Predicate } from "./horizon";

/** "1234567.1200000" -> "1,234,567.12". Keeps up to `max` decimals, no float rounding errors. */
export function formatAmount(value: string | number | undefined, max = 7): string {
  if (value === undefined || value === null || value === "") return "—";
  const s = typeof value === "number" ? value.toFixed(7) : String(value);
  const neg = s.startsWith("-");
  const [intRaw, fracRaw = ""] = (neg ? s.slice(1) : s).split(".");
  const int = (intRaw.replace(/^0+(?=\d)/, "") || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracRaw.slice(0, max).replace(/0+$/, "");
  return `${neg ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

/** Compact form for large figures: 100000000000 -> "100B". */
export function compact(value: string | number, locale = "en") {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

/** Stroops (1e-7 Pi) -> Pi string. */
export function stroopsToPi(stroops: string | number) {
  const n = BigInt(String(stroops));
  const whole = n / 10_000_000n;
  const frac = (n % 10_000_000n).toString().padStart(7, "0");
  return formatAmount(`${whole}.${frac}`);
}

export function shortId(id: string, head = 6, tail = 6) {
  if (!id) return "";
  return id.length <= head + tail + 1 ? id : `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function assetLabel(
  type: string | undefined,
  code?: string,
  native = "Pi",
): string {
  if (!type || type === "native") return native;
  if (type === "liquidity_pool_shares") return "LP";
  return code ?? "?";
}

/** Horizon's "CODE:ISSUER" or "native" canonical form. */
export function canonicalAssetLabel(canonical: string, native = "Pi") {
  if (canonical === "native") return native;
  return canonical.split(":")[0];
}

export function timeAgo(iso: string, now = Date.now(), lang: "ar" | "en" = "en") {
  const sec = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en", { numeric: "auto" });
  if (sec < 60) return rtf.format(-sec, "second");
  const min = Math.round(sec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (hr < 48) return rtf.format(-hr, "hour");
  return rtf.format(-Math.round(hr / 24), "day");
}

export function formatDate(iso: string, lang: "ar" | "en" = "en") {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(iso)) + " UTC";
}

/**
 * Pi lockups are claimable balances the owner can claim only after a date:
 * predicate { not: { abs_before: T } }. Returns that date, or null when the
 * balance is claimable now / has no simple time lock.
 */
export function unlockTime(p: Predicate): string | null {
  if (p.not?.abs_before) return p.not.abs_before;
  if (p.and) {
    const times = p.and.map(unlockTime).filter((t): t is string => !!t);
    return times.sort().at(-1) ?? null;
  }
  return null;
}

/** Latest time the balance can still be claimed ({ abs_before: T }), if any. */
export function expiryTime(p: Predicate): string | null {
  if (p.abs_before) return p.abs_before;
  if (p.and) return p.and.map(expiryTime).find(Boolean) ?? null;
  return null;
}

export type SearchTarget =
  | { kind: "ledger"; value: string }
  | { kind: "tx"; value: string }
  | { kind: "account"; value: string }
  | { kind: "claimable"; value: string }
  | { kind: "asset"; value: string }
  | { kind: "unknown"; value: string };

/** Decide what a search box string refers to. */
export function classifySearch(raw: string): SearchTarget {
  const q = raw.trim();
  if (/^\d{1,12}$/.test(q)) return { kind: "ledger", value: String(Number(q)) };
  if (/^[0-9a-fA-F]{64}$/.test(q)) return { kind: "tx", value: q.toLowerCase() };
  if (/^[0-9a-fA-F]{72}$/.test(q)) return { kind: "claimable", value: q.toLowerCase() };
  if (/^G[A-Z2-7]{55}$/.test(q.toUpperCase())) return { kind: "account", value: q.toUpperCase() };
  if (/^[a-zA-Z0-9]{1,12}$/.test(q)) return { kind: "asset", value: q.toUpperCase() };
  return { kind: "unknown", value: q };
}

/**
 * The real owner of a Pi lockup. Migration lockups have two claimants: the sender, who can
 * take it back only before a date, and the owner, who can claim only after a date ({ not: … }).
 */
export function lockOwner<T extends { destination: string; predicate: Predicate }>(claimants: T[]): T | undefined {
  return claimants.find((c) => unlockTime(c.predicate)) ?? claimants[claimants.length - 1];
}
