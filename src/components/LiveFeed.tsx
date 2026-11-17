"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { shortId, stroopsToPi, timeAgo } from "@/lib/format";
import type { Latest } from "@/lib/latest";

interface Labels {
  latestBlocks: string;
  latestTxs: string;
  viewAll: string;
  live: string;
  paused: string;
  txs: string;
  ops: string;
  failed: string;
  block: string;
  fee: string;
}

const POLL_MS = 5000;

export function LiveFeed({ initial, labels, lang, native }: { initial: Latest; labels: Labels; lang: "ar" | "en"; native: string }) {
  const [data, setData] = useState(initial);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Set(initial.ledgers.map((l) => l.sequence)));
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/latest?net=${initial.net}`, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const next = (await res.json()) as Latest;
          if (stop) return;
          const added = new Set(next.ledgers.filter((l) => !seen.current.has(l.sequence)).map((l) => l.sequence));
          next.ledgers.forEach((l) => seen.current.add(l.sequence));
          setFresh(added);
          setData(next);
          setOnline(true);
        } catch {
          if (!stop) setOnline(false);
        }
      }
      setNow(Date.now());
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [initial.net]);

  const status = <span className={`live-dot${online ? "" : " off"}`}>{online ? labels.live : labels.paused}</span>;

  return (
    <div className="grid-2">
      <section className="card">
        <header className="card-head">
          <h2>{labels.latestBlocks}</h2>
          <span className="head-actions">
            {status}
            <Link href="/blocks">{labels.viewAll}</Link>
          </span>
        </header>
        <ul className="rows">
          {data.ledgers.map((l) => (
            <li key={l.sequence} className={fresh.has(l.sequence) ? "flash" : undefined}>
              <span className="row-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
                  <path d="M4 7.5 12 12l8-4.5M12 12v9" />
                </svg>
              </span>
              <div className="main-col">
                <Link href={`/blocks/${l.sequence}`}>
                  <bdi className="mono" dir="ltr">#{l.sequence.toLocaleString("en")}</bdi>
                </Link>
                <span className="meta" suppressHydrationWarning>{timeAgo(l.closed_at, now, lang)}</span>
              </div>
              <div className="side-col">
                <span>
                  {l.txs} {labels.txs} · {l.ops} {labels.ops}
                </span>
                {l.failed ? <span className="meta">{l.failed} {labels.failed}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <header className="card-head">
          <h2>{labels.latestTxs}</h2>
          <span className="head-actions">
            {status}
            <Link href="/txs">{labels.viewAll}</Link>
          </span>
        </header>
        <ul className="rows">
          {data.txs.map((t) => (
            <li key={t.hash}>
              <span className="row-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h13l-3-3M20 16H7l3 3" />
                </svg>
              </span>
              <div className="main-col">
                <Link href={`/tx/${t.hash}`}>
                  <bdi className="mono" dir="ltr">{shortId(t.hash, 8, 8)}</bdi>
                </Link>
                <span className="meta" suppressHydrationWarning>
                  <Link href={`/account/${t.source}`}>
                    <bdi className="mono" dir="ltr">{shortId(t.source, 5, 5)}</bdi>
                  </Link>{" "}
                  · {timeAgo(t.created_at, now, lang)}
                </span>
              </div>
              <div className="side-col">
                <span>
                  {t.ops} {labels.ops}
                  {t.ok ? null : <span className="badge bad" style={{ marginInlineStart: 6 }}>{labels.failed}</span>}
                </span>
                <span className="meta">
                  {labels.fee} <bdi dir="ltr">{stroopsToPi(t.fee)}</bdi> {native}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
