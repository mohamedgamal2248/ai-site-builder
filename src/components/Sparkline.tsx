/** Tiny single-series line for stat cards. Values are also stated in the card text. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const W = 120;
  const H = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / span) * (H - 4)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(",");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={pts.join(" ")} fill="none" />
      <circle cx={last[0]} cy={last[1]} r="2.5" />
    </svg>
  );
}

/** Low / medium / high meter for ledger capacity. */
export function LoadMeter({ pct, labels }: { pct: number; labels: { low: string; medium: string; high: string } }) {
  const level = pct < 30 ? "low" : pct < 70 ? "medium" : "high";
  return (
    <div className={`load load-${level}`}>
      <div className="load-head">
        <strong>{labels[level]}</strong>
        <bdi dir="ltr">{pct}%</bdi>
      </div>
      <div className="load-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}
