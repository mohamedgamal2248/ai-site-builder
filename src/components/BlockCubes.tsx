"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { Latest, LatestLedger } from "@/lib/activity";
import { HoverLink as Link } from "./HoverLink";

/**
 * The last ten blocks as cubes (newest first), fed by the live stream in the shared feed cache.
 * Fill height and colour follow how busy each block was; a new block slides in at the front.
 */
export function BlockCubes({ net, initial, labels }: { net: string; initial: LatestLedger[]; labels: { title: string; ops: string; txs: string } }) {
  const qc = useQueryClient();
  const subscribe = useCallback((cb: () => void) => qc.getQueryCache().subscribe(cb), [qc]);
  const data = useSyncExternalStore(subscribe, () => qc.getQueryData<Latest>(["latest", net]) ?? null, () => null);
  const ledgers = (data?.ledgers ?? initial).slice(0, 10);
  const max = Math.max(20, ...ledgers.map((l) => l.ops));

  return (
    <section className="cubes" aria-label={labels.title}>
      <div className="cubes-track">
        {ledgers.map((l, i) => {
          const fill = Math.max(0.08, Math.min(1, l.ops / max));
          return (
            <Link key={l.sequence} href={`/blocks/${l.sequence}`} className={`cube${i === 0 ? " newest" : ""}`} title={`#${l.sequence} · ${l.ops} ${labels.ops}`}>
              <span className="cube-fill" style={{ height: `${fill * 100}%`, opacity: 0.35 + fill * 0.65 }} aria-hidden="true" />
              <span className="cube-seq"><bdi dir="ltr">#{String(l.sequence).slice(-4)}</bdi></span>
              <span className="cube-ops"><bdi dir="ltr">{l.txs}</bdi> {labels.txs}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
