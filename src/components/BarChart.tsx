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
const PAD_LEFT = 48;
const BAR_MAX = 24;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function tick(v: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: Math.abs(v) >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v);
}

/**
 * Single-series column chart: thin columns with rounded ends, hairline grid,
 * hover tooltip, the extreme labelled. Negative values grow down from a zero line
 * in a second colour (used for net flows). Values also appear in a table under it.
 */
export function BarChart({ bars, locale, ariaLabel, warmPositive = false }: { bars: Bar[]; locale: string; ariaLabel: string; warmPositive?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(320, bars.length * 28 + PAD_LEFT);
  const hasNeg = bars.some((b) => b.value < 0);
  const top = niceMax(Math.max(0, ...bars.map((b) => b.value)));
  const bottom = hasNeg ? -niceMax(Math.max(0, ...bars.map((b) => -b.value))) : 0;
  const hi = hasNeg && Math.max(0, ...bars.map((b) => b.value)) === 0 ? 0 : top;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const slot = (W - PAD_LEFT) / Math.max(1, bars.length);
  const bw = Math.min(BAR_MAX, slot * 0.6);
  const span = hi - bottom || 1;
  const y = (v: number) => PAD_TOP + ((hi - v) / span) * plotH;
  const zero = y(0);
  const extreme = bars.reduce((best, b, i) => (Math.abs(b.value) > Math.abs(bars[best]?.value ?? 0) ? i : best), 0);
  const labelEvery = Math.ceil(bars.length / 8);
  const ticks = hasNeg ? [bottom, 0, hi].filter((v, i, a) => a.indexOf(v) === i) : [0, hi / 2, hi];

  return (
    <div className="chart" dir="ltr">
      <div className="chart-scroll">
        <div className="chart-inner" style={{ width: W }}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={PAD_LEFT} x2={W} y1={y(v)} y2={y(v)} className={v === 0 && hasNeg ? "grid zero" : "grid"} />
                <text x={PAD_LEFT - 6} y={y(v) + 4} textAnchor="end" className="axis">
                  {tick(v, locale)}
                </text>
              </g>
            ))}
            {bars.map((b, i) => {
              const cx = PAD_LEFT + slot * i + slot / 2;
              const end = y(b.value);
              const h = Math.abs(end - zero);
              const r = Math.min(4, h, bw / 2);
              const x0 = cx - bw / 2;
              let d = "";
              if (h > 0 && b.value > 0) {
                d = `M${x0},${zero} V${end + r} Q${x0},${end} ${x0 + r},${end} H${x0 + bw - r} Q${x0 + bw},${end} ${x0 + bw},${end + r} V${zero} Z`;
              } else if (h > 0) {
                d = `M${x0},${zero} V${end - r} Q${x0},${end} ${x0 + r},${end} H${x0 + bw - r} Q${x0 + bw},${end} ${x0 + bw},${end - r} V${zero} Z`;
              }
              return (
                <g key={b.key}>
                  {d ? <path d={d} className={`bar${(b.value < 0) !== warmPositive ? " neg" : ""}${hover === i ? " on" : ""}`} /> : null}
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
                  {i === extreme && b.value !== 0 && hover === null ? (
                    <text x={cx} y={b.value > 0 ? end - 6 : end + 14} textAnchor="middle" className="peak">
                      {tick(b.value, locale)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {hover !== null && bars[hover] ? (
            <div className="chart-tip" style={{ left: PAD_LEFT + slot * hover + slot / 2 }} role="status">
              <strong>{bars[hover].display}</strong>
              <span>{bars[hover].label}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
