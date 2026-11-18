/**
 * Donut / ring chart (pure SVG, renders on the server). Kept to at most three coloured parts
 * plus a neutral "rest" (validated palette: purple, orange, green; see dataviz rules), with a
 * 2px surface gap between parts, the total in the middle and a legend that repeats every
 * figure, so colour is never the only way to read it. Hovering a part or its legend row
 * highlights it; each part also carries a native tooltip.
 */
export interface Slice {
  key: string;
  label: string;
  value: number;
  /** Already formatted amount for the legend and tooltip. */
  display: string;
  /** 1–3 = categorical slots, 0 = neutral (rest / track). */
  tone: 0 | 1 | 2 | 3;
}

export function Donut({ slices, center, sub, ariaLabel, size = 168, legend = true, pctDigits = 1 }: { slices: Slice[]; center?: string; sub?: string; ariaLabel: string; size?: number; legend?: boolean; pctDigits?: number }) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  const R = 42;
  const C = 2 * Math.PI * R;
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 1.2 : 0;
  let acc = 0;
  const pct = (v: number) => `${((v / total) * 100).toFixed(pctDigits)}%`;
  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${ariaLabel}: ${slices.map((s) => `${s.label} ${pct(s.value)}`).join(", ")}`}>
        <circle cx="50" cy="50" r={R} className="donut-track" />
        {slices.map((s, i) => {
          const len = (Math.max(0, s.value) / total) * C;
          const dash = Math.max(0, len - gap);
          const el = (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={R}
              className={`donut-seg tone-${s.tone}`}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-acc}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <title>{`${s.label}: ${s.display} (${pct(s.value)})`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
        {center ? (
          <text x="50" y={sub ? 49 : 54} textAnchor="middle" className="donut-center" style={{ fontSize: Math.max(7.5, Math.min(13, 70 / Math.max(5, center.length))) }}>{center}</text>
        ) : null}
        {sub ? <text x="50" y="61" textAnchor="middle" className="donut-sub">{sub}</text> : null}
      </svg>
      {legend ? (
        <ul className="donut-legend">
          {slices.map((s) => (
            <li key={s.key}>
              <span className={`sw tone-${s.tone}`} aria-hidden="true" />
              <span className="lg-label">{s.label}</span>
              <span className="lg-val"><bdi dir="ltr">{s.display}</bdi></span>
              <span className="lg-pct"><bdi dir="ltr">{pct(s.value)}</bdi></span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Horizontal bars, one hue, largest first (or in the given order). The top bar can be flagged. */
export function HBars({ rows, ariaLabel, peakLabel }: { rows: { key: string; label: string; value: number; display: string; peak?: boolean }[]; ariaLabel: string; peakLabel?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="hbars" aria-label={ariaLabel}>
      {rows.map((r, i) => (
        <li key={r.key} className={r.peak ? "peak" : undefined} title={`${r.label}: ${r.display}`}>
          <span className="hb-label">{r.label}</span>
          <span className="hb-track" aria-hidden="true"><span className="hb-bar" style={{ width: `${(r.value / max) * 100}%`, animationDelay: `${i * 50}ms` }} /></span>
          <span className="hb-val"><bdi dir="ltr">{r.display}</bdi>{r.peak && peakLabel ? <span className="hb-tag">{peakLabel}</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}

/** Diverging horizontal bars around a centre line: warm to one side, purple to the other. */
export function DivergingBars({ rows, ariaLabel, max = 3, labels }: { rows: { key: string; label: string; value: number | null; display: string }[]; ariaLabel: string; max?: number; labels: [string, string] }) {
  return (
    <div className="dbars" aria-label={ariaLabel}>
      <div className="db-axis" aria-hidden="true"><span>{labels[0]}</span><span>{labels[1]}</span></div>
      <ul>
        {rows.map((r) => {
          const v = r.value === null ? 0 : Math.max(-max, Math.min(max, r.value));
          const w = (Math.abs(v) / max) * 50;
          return (
            <li key={r.key} title={`${r.label}: ${r.display}`}>
              <span className="db-label">{r.label}</span>
              <span className="db-track" dir="ltr" aria-hidden="true">
                <span className="db-mid" />
                {r.value === null ? null : <span className={`db-bar ${v < 0 ? "neg" : "pos"}`} style={v < 0 ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }} />}
              </span>
              <span className="db-val"><bdi dir="ltr">{r.display}</bdi></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
