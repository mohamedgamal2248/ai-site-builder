"use client";

import { useEffect, useRef, useState } from "react";

/** Live PI/USDT from OKX, polled by the browser (no server cost). Flashes green/red on change. */
export function PriceTicker({ last, changePct, label }: { last: number; changePct: number; label: string }) {
  const [p, setP] = useState({ last, changePct });
  const [dir, setDir] = useState<"" | "tick-up" | "tick-down">("");
  const prev = useRef(last);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stop = false;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("https://www.okx.com/api/v5/market/ticker?instId=PI-USDT", { cache: "no-store" });
          const d = ((await r.json()) as { data?: { last: string; open24h: string }[] }).data?.[0];
          const l = Number(d?.last);
          const o = Number(d?.open24h);
          if (!stop && Number.isFinite(l) && o) {
            if (l !== prev.current) {
              setDir(l > prev.current ? "tick-up" : "tick-down");
              setTimeout(() => setDir(""), 900);
            }
            prev.current = l;
            setP({ last: l, changePct: ((l - o) / o) * 100 });
          }
        } catch {
          /* keep the last value */
        }
      }
      if (!stop) timer = setTimeout(tick, 15_000);
    };
    timer = setTimeout(tick, 15_000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div className={`v price-v ${dir}`} aria-live="polite">
        <bdi dir="ltr">${p.last.toFixed(4)}</bdi>
      </div>
      <div className="s">
        <span className={`chg ${p.changePct >= 0 ? "up" : "down"}`}>
          <bdi dir="ltr">
            {p.changePct >= 0 ? "▲" : "▼"} {Math.abs(p.changePct).toFixed(2)}%
          </bdi>
        </span>
        <span>{label}</span>
      </div>
    </>
  );
}
