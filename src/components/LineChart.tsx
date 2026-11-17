"use client";

import { useRef, useState } from "react";

export interface Point {
  t: number;
  v: number;
}

const H = 200;
const PAD_TOP = 14;
const PAD_BOTTOM = 24;
const PAD_LEFT = 52;
const PAD_RIGHT = 10;

/**
 * Single-series line with a light area wash, crosshair and tooltip. Fills its
 * container width; the first and last values are stated in the card text.
 */
export function LineChart({ points, prefix = "", decimals = 4, locale, timeMode, ariaLabel }: { points: Point[]; prefix?: string; decimals?: number; locale: string; timeMode: "hour" | "dayhour" | "day"; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const format = (v: number) => `${prefix}${v.toFixed(decimals)}`;
  const formatTime = (t: number) =>
    new Intl.DateTimeFormat(
      locale,
      timeMode === "hour"
        ? { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }
        : timeMode === "dayhour"
          ? { month: "short", day: "numeric", hour: "2-digit", timeZone: "UTC" }
          : { month: "short", day: "numeric", timeZone: "UTC" },
    ).format(t);
  const box = useRef<HTMLDivElement>(null);
  if (points.length < 2) return null;
  const W = 640;
  const vs = points.map((p) => p.v);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  const pad = (hi - lo) * 0.08 || hi * 0.01 || 1;
  lo -= pad;
  hi += pad;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const x = (t: number) => PAD_LEFT + ((t - t0) / (t1 - t0 || 1)) * (W - PAD_LEFT - PAD_RIGHT);
  const y = (v: number) => PAD_TOP + ((hi - v) / (hi - lo)) * (H - PAD_TOP - PAD_BOTTOM);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(1)},${H - PAD_BOTTOM} L${x(t0).toFixed(1)},${H - PAD_BOTTOM} Z`;
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const hp = hover !== null ? points[hover] : null;

  const onMove = (clientX: number) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    const t = t0 + ((sx - PAD_LEFT) / (W - PAD_LEFT - PAD_RIGHT)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    setHover(best);
  };

  return (
    <div
      className="chart line-chart"
      dir="ltr"
      ref={box}
      onMouseMove={(e) => onMove(e.clientX)}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => onMove(e.touches[0].clientX)}
      onTouchMove={(e) => onMove(e.touches[0].clientX)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} style={{ width: "100%", height: H }}>
        {ticks.map((v) => (
          <line key={v} x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={y(v)} y2={y(v)} className="grid" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} className="area" />
        <path d={line} className="line" vectorEffect="non-scaling-stroke" />
        {hp ? <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD_TOP} y2={H - PAD_BOTTOM} className="crosshair" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <div className="line-axis">
        {ticks.map((v) => (
          <span key={v} style={{ top: y(v) - 8 }}>{format(v)}</span>
        ))}
      </div>
      <div className="line-x">
        <span>{formatTime(t0)}</span>
        <span>{formatTime(t1)}</span>
      </div>
      {hp ? (
        <>
          <span className="dot-marker" style={{ left: `${(x(hp.t) / W) * 100}%`, top: y(hp.v) }} />
          <div className="chart-tip" style={{ left: `${(x(hp.t) / W) * 100}%` }} role="status">
            <strong>{format(hp.v)}</strong>
            <span>{formatTime(hp.t)}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
