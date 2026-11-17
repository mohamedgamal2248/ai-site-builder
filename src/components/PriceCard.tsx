"use client";

import { useEffect, useState } from "react";
import { LineChart, type Point } from "./LineChart";

const RANGES = ["24h", "7d", "30d"] as const;

export function PriceCard({ initial, labels, locale }: { initial: Point[]; labels: { title: string; source: string; ranges: Record<(typeof RANGES)[number], string> }; locale: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("7d");
  const [points, setPoints] = useState(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (range === "7d" && points === initial) return;
    let stop = false;
    setLoading(true);
    fetch(`/api/v1/price-history?range=${range}`)
      .then((r) => r.json())
      .then((d: { points: Point[] }) => !stop && setPoints(d.points))
      .catch(() => {})
      .finally(() => !stop && setLoading(false));
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const first = points[0]?.v;
  const last = points[points.length - 1]?.v;
  const pct = first && last ? ((last - first) / first) * 100 : null;

  return (
    <section className="card">
      <header className="card-head">
        <h2>
          {labels.title}{" "}
          {pct !== null ? (
            <span className={pct >= 0 ? "up" : "down"} style={{ fontSize: 13 }}>
              <bdi dir="ltr">{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%</bdi>
            </span>
          ) : null}
        </h2>
        <div className="tabs filter-tabs" style={{ margin: 0 }}>
          {RANGES.map((r) => (
            <button key={r} type="button" className={r === range ? "active" : undefined} aria-pressed={r === range} onClick={() => setRange(r)}>
              {labels.ranges[r]}
            </button>
          ))}
        </div>
      </header>
      <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity .2s" }}>
        <LineChart points={points} prefix="$" decimals={4} locale={locale} timeMode={range === "30d" ? "day" : range === "7d" ? "dayhour" : "hour"} ariaLabel={labels.title} />
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>{labels.source}</p>
    </section>
  );
}
