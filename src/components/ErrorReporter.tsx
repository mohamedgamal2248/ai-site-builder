"use client";

import { useEffect } from "react";

/**
 * Sends uncaught browser errors to /api/errors (stored in our own database, no third party).
 * At most 3 reports per page view, duplicates skipped, so a broken loop cannot flood it.
 */
let sent = 0;
const seen = new Set<string>();

export function reportError(message: string, stack?: string) {
  if (sent >= 3 || typeof navigator === "undefined") return;
  const key = message.slice(0, 120);
  if (seen.has(key) || /ResizeObserver|Script error\.?$|extension:\/\//i.test(message)) return;
  seen.add(key);
  sent++;
  const body = JSON.stringify({ message: message.slice(0, 500), stack: stack?.slice(0, 1500), path: location.pathname, ua: navigator.userAgent.slice(0, 200) });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/errors", new Blob([body], { type: "application/json" }));
    else void fetch("/api/errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    /* never throw from the reporter */
  }
}



type Queue = [string, string][] | { push: (e: [string, string]) => void };

export function ErrorReporter() {
  useEffect(() => {
    // Google Translate and similar tools rewrite the page, a common cause of React errors.
    const tag = () => (/\btranslated-(ltr|rtl)\b/.test(document.documentElement.className) ? "[translated] " : "");
    const w = window as unknown as { __bpErr?: Queue };
    const early = Array.isArray(w.__bpErr) ? (w.__bpErr as [string, string][]) : [];
    for (const [m, st] of early) reportError(tag() + m, st);
    w.__bpErr = { push: (e: [string, string]) => reportError(tag() + e[0], e[1]) };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | undefined;
      reportError(`unhandled: ${r?.message ?? String(e.reason)}`, r?.stack);
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
