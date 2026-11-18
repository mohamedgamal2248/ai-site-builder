"use client";

import { tipPos } from "./tipPos";

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
export function LineChart({ points: all, prefix = "", decimals = 4, locale, timeMode, ariaLabel, showChange = true }: { points: Point[]; prefix?: string; decimals?: number; locale: string; timeMode: "hour" | "dayhour" | "day"; ariaLabel: string; showChange?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  // Drag across the chart to zoom into a window; the change over that window is shown above it.
  const [win, setWin] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const ar = locale.startsWith("ar");
  const points = win ? all.slice(win[0], win[1] + 1) : all;
  const offset = win ? win[0] : 0;
  // Large values (Pi totals) read better as "554.9M" than as nine digits.
  const format = (v: number) =>
    Math.abs(v) >= 100_000 ? `${prefix}${new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(v)}` : `${prefix}${v.toFixed(decimals)}`;
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

  const indexAt = (clientX: number) => {
    const el = box.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    const t = t0 + ((sx - PAD_LEFT) / (W - PAD_LEFT - PAD_RIGHT)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    return best;
  };
  const onMove = (clientX: number) => {
    const i = indexAt(clientX);
    setHover(i);
    if (drag) setDrag([drag[0], i]);
  };
  const endDrag = () => {
    if (drag && Math.abs(drag[1] - drag[0]) >= 3) {
      const a = Math.min(drag[0], drag[1]) + offset;
      const b = Math.max(drag[0], drag[1]) + offset;
      setWin([a, b]);
      setHover(null);
    }
    setDrag(null);
  };
  const first = points[0].v;
  const last = points[points.length - 1].v;
  const changePct = first ? ((last - first) / first) * 100 : 0;
  const sel = drag && drag[0] !== drag[1] ? [Math.min(drag[0], drag[1]), Math.max(drag[0], drag[1])] : null;

  return (
    <>
    <div className="zoom-bar">
      <span className="muted">{win ? `${formatTime(t0)} → ${formatTime(t1)}` : ar ? "اسحب على الرسم عشان تكبّر فترة" : "Drag across the chart to zoom in"}</span>
      {showChange ? <span className={changePct >= 0 ? "up" : "down"}><bdi dir="ltr">{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%</bdi></span> : null}
      {win ? <button type="button" className="zoom-reset" onClick={() => setWin(null)}>{ar ? "إعادة الضبط" : "Reset zoom"}</button> : null}
    </div>
    <div
      className="chart line-chart"
      dir="ltr"
      ref={box}
      onPointerDown={(e) => {
        const i = indexAt(e.clientX);
        setHover(i);
        setDrag([i, i]);
      }}
      onPointerMove={(e) => onMove(e.clientX)}
      onPointerUp={endDrag}
      onPointerCancel={() => setDrag(null)}
      onPointerLeave={() => {
        setHover(null);
        setDrag(null);
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} style={{ width: "100%", height: H }}>
        {ticks.map((v) => (
          <line key={v} x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={y(v)} y2={y(v)} className="grid" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} className="area" />
        <path d={line} className="line" pathLength={1} vectorEffect="non-scaling-stroke" />
        {hp ? <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD_TOP} y2={H - PAD_BOTTOM} className="crosshair" vectorEffect="non-scaling-stroke" /> : null}
        {sel ? <rect x={x(points[sel[0]].t)} y={PAD_TOP} width={x(points[sel[1]].t) - x(points[sel[0]].t)} height={H - PAD_TOP - PAD_BOTTOM} className="zoom-sel" /> : null}
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
          <div className="chart-tip" style={tipPos(x(hp.t) / W, `${(x(hp.t) / W) * 100}%`)} role="status">
            <strong>{format(hp.v)}</strong>
            <span>{formatTime(hp.t)}</span>
          </div>
        </>
      ) : null}
    </div>
    </>
  );
}
