"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

/**
 * "2 minutes ago", computed in the browser and kept current. Pages are cached on the CDN,
 * so a server-side relative time would be stale; all instances share one ticking clock.
 */
const listeners = new Set<(n: number) => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(fn: (n: number) => void) {
  listeners.add(fn);
  timer ??= setInterval(() => {
    const n = Date.now();
    listeners.forEach((l) => l(n));
  }, 10_000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function Ago({ iso, lang, title }: { iso: string; lang: "ar" | "en"; title?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    return subscribe(setNow);
  }, []);
  return (
    <span title={title} suppressHydrationWarning>
      {timeAgo(iso, now ?? Date.now(), lang)}
    </span>
  );
}
