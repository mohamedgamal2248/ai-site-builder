"use client";

import { useState } from "react";

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Text shown in the tooltip, already formatted. */
  display: string;
}

const H = 180;
const PAD_TOP = 22;
const PAD_BOTTOM = 26;
const PAD_LEFT = 44;
const BAR_MAX = 24;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function tick(v: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: v >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v);
}

/**
 * Single-series column chart: thin columns with rounded tops, hairline grid,
 * hover tooltip, the peak labelled. Values also appear in the table under it.
 */
export function BarChart({ bars, locale, ariaLabel }: { bars: Bar[]; locale: string; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(320, bars.length * 28 + PAD_LEFT);
  const max = niceMax(Math.max(0, ...bars.map((b) => b.value)));
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const slot = (W - PAD_LEFT) / Math.max(1, bars.length);
  const bw = Math.min(BAR_MAX, slot * 0.6);
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;
  const peak = bars.reduce((best, b, i) => (b.value > (bars[best]?.value ?? -1) ? i : best), 0);
  const labelEvery = Math.ceil(bars.length / 8);
  const ticks = [0, max / 2, max];

  return (
    <div className="chart" dir="ltr">
      <div className="chart-scroll">
      <div className="chart-inner" style={{ width: W }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_LEFT} x2={W} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD_LEFT - 6} y={y(v) + 4} textAnchor="end" className="axis">
              {tick(v, locale)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = PAD_LEFT + slot * i + slot / 2;
          const top = y(b.value);
          const h = Math.max(0, PAD_TOP + plotH - top);
          const r = Math.min(4, h, bw / 2);
          const x0 = cx - bw / 2;
          const base = PAD_TOP + plotH;
          const d =
            h <= 0
              ? ""
              : `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${base} Z`;
          return (
            <g key={b.key}>
              {d ? <path d={d} className={`bar${hover === i ? " on" : ""}`} /> : null}
              {/* Hit target wider and taller than the mark. */}
              <rect
                x={PAD_LEFT + slot * i}
                y={PAD_TOP}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                tabIndex={0}
                aria-label={`${b.label}: ${b.display}`}
              />
              {i % labelEvery === 0 || i === bars.length - 1 ? (
                <text x={cx} y={H - 8} textAnchor="middle" className="axis">
                  {b.label}
                </text>
              ) : null}
              {i === peak && b.value > 0 && hover === null ? (
                <text x={cx} y={top - 6} textAnchor="middle" className="peak">
                  {tick(b.value, locale)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null && bars[hover] ? (
        <div
          className="chart-tip"
          style={{ left: PAD_LEFT + slot * hover + slot / 2 }}
          role="status"
        >
          <strong>{bars[hover].display}</strong>
          <span>{bars[hover].label}</span>
        </div>
      ) : null}
      </div>
      </div>
    </div>
  );
}
