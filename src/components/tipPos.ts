import type { CSSProperties } from "react";

/**
 * Tooltip placement that never leaves the chart: centred over the point in the middle,
 * sliding so its left edge meets the point near the left side and its right edge near the right.
 * `f` is the point's position across the chart (0–1).
 */
export function tipPos(f: number, left: string): CSSProperties {
  const k = Math.max(0, Math.min(1, f));
  return { left, transform: `translateX(-${(k * 100).toFixed(1)}%)` };
}
