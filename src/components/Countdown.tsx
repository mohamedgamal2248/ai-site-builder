"use client";

import { useEffect, useState } from "react";

/** Live countdown to a date: "12d 04:31:09" style, localised units. */
export function Countdown({ to, lang }: { to: string; lang: "ar" | "en" }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className="countdown">…</span>;
  let s = Math.max(0, Math.floor((Date.parse(to) - now) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const p = (n: number) => String(n).padStart(2, "0");
  const unit = lang === "ar" ? { d: "يوم", h: "س", m: "د", s: "ث" } : { d: "d", h: "h", m: "m", s: "s" };
  return (
    <span className="countdown" dir="ltr">
      {d > 0 ? <b>{d}<small>{unit.d}</small></b> : null}
      <b>{p(h)}<small>{unit.h}</small></b>
      <b>{p(m)}<small>{unit.m}</small></b>
      <b>{p(s)}<small>{unit.s}</small></b>
    </span>
  );
}
