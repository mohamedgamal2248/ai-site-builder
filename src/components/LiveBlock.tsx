"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { Latest } from "@/lib/activity";
import { Ago } from "./Ago";
import { HoverLink as Link } from "./HoverLink";

/** Latest block number that follows the live stream held in the shared feed cache. */
export function LiveBlock({ net, seq, closedAt, lang }: { net: string; seq: number; closedAt: string; lang: "ar" | "en" }) {
  // Read-only view of the feed cache (never creates the entry, so the feed keeps control of it).
  const qc = useQueryClient();
  const subscribe = useCallback((cb: () => void) => qc.getQueryCache().subscribe(cb), [qc]);
  const data = useSyncExternalStore(
    subscribe,
    () => qc.getQueryData<Latest>(["latest", net]) ?? null,
    () => null,
  );
  const top = data?.ledgers[0];
  const s = top && top.sequence > seq ? top.sequence : seq;
  const at = top && top.sequence > seq ? top.closed_at : closedAt;
  return (
    <>
      <div className="value">
        <Link href={`/blocks/${s}`}>
          <bdi dir="ltr" key={s} className="tick">#{s.toLocaleString("en")}</bdi>
        </Link>
      </div>
      <div className="hint"><Ago iso={at} lang={lang} /></div>
    </>
  );
}
