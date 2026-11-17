/** Half-circle gauge for a 0–100 score: sell side warm, buy side purple, neutral grey in the middle. */
export function Gauge({ score, label, size = 220 }: { score: number | null; label: string; size?: number }) {
  const r = 80;
  const cx = 100;
  const cy = 95;
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    return `M${cx + r * Math.cos(a0)},${cy - r * Math.sin(a0)} A${r},${r} 0 0 1 ${cx + r * Math.cos(a1)},${cy - r * Math.sin(a1)}`;
  };
  const bands: [number, number, string][] = [
    [0, 30, "g-sell2"],
    [30.6, 45, "g-sell"],
    [45.6, 55, "g-flat"],
    [55.6, 70, "g-buy"],
    [70.6, 100, "g-buy2"],
  ];
  const a = score === null ? null : Math.PI * (1 - score / 100);
  return (
    <svg viewBox="0 0 200 110" width={size} height={(size * 110) / 200} role="img" aria-label={`${label}: ${score ?? "—"}`} className="gauge">
      {bands.map(([f, t, c]) => (
        <path key={c} d={arc(f, t)} className={c} fill="none" strokeWidth="14" />
      ))}
      {a !== null ? (
        <>
          <g className="g-needle-wrap" style={{ ["--rot" as string]: `${((score as number) - 50) * 1.8}deg` }}>
            <line x1={cx} y1={cy} x2={cx} y2={cy - (r - 18)} className="g-needle" strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx={cx} cy={cy} r="6" className="g-hub" />
        </>
      ) : null}
    </svg>
  );
}
