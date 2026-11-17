"use client";

import { useEffect, useRef, useState } from "react";
import { formatAmount, shortId, timeAgo } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { buildLatest, type ActivityKind, type Latest } from "@/lib/activity";
import type { Ledger, Operation } from "@/lib/horizon";
import { HoverLink as Link } from "./HoverLink";
import { knownWallet } from "@/data/wallets";
import { WalletBadge } from "./WalletBadge";

const POLL_MS = 5000;
const FILTERS: ("all" | ActivityKind)[] = ["all", "payment", "lock", "claim", "create"];

function Acc({ id }: { id?: string }) {
  if (!id) return <span className="muted">—</span>;
  const known = knownWallet(id);
  if (known) {
    return (
      <Link href={`/account/${id}`} className="id-link known" title={id}>
        <WalletBadge logo={known.logo} size={15} />
        <span>{known.label.split(" · ")[0]}</span>
      </Link>
    );
  }
  return (
    <Link href={`/account/${id}`}>
      <bdi className="mono" dir="ltr">{shortId(id, 4, 4)}</bdi>
    </Link>
  );
}

/**
 * Reads Pi's Horizon API straight from the browser (it allows cross-origin requests), so
 * the live feed costs our server nothing. Falls back to /api/latest if Horizon is unreachable.
 */
async function poll(horizon: string, net: Latest["net"]): Promise<Latest> {
  try {
    const get = async <T,>(path: string) => {
      const r = await fetch(`${horizon}${path}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      return ((await r.json()) as { _embedded: { records: T[] } })._embedded.records;
    };
    const [ledgers, ops] = await Promise.all([
      get<Ledger>("/ledgers?order=desc&limit=11"),
      get<Operation>("/operations?order=desc&limit=40&include_failed=true"),
    ]);
    return buildLatest(net, ledgers, ops);
  } catch {
    const r = await fetch(`/api/latest?net=${net}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as Latest;
  }
}

export function LiveFeed({ initial, t, lang, horizon, tabs }: { initial: Latest; t: Dict; lang: "ar" | "en"; horizon: string; tabs: { blocks: string; activity: string } }) {
  const [view, setView] = useState<"activity" | "blocks">("activity");
  const [data, setData] = useState(initial);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const seen = useRef(new Set(initial.ledgers.map((l) => l.sequence)));
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const next = await poll(horizon, initial.net);
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
  }, [initial.net, horizon]);

  const status = <span className={`live-dot${online ? "" : " off"}`}>{online ? t.live : t.paused}</span>;
  const kindLabel: Record<ActivityKind, string> = {
    payment: t.kindPayment,
    lock: t.kindLock,
    claim: t.kindClaim,
    create: t.kindCreate,
    other: t.kindOther,
  };
  const rows = data.activity.filter((a) => filter === "all" || a.kind === filter);

  return (
    <div className={`grid-feed live-feed show-${view}`}>
      <div className="feed-switch" role="tablist">
        {(["activity", "blocks"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "active" : undefined} onClick={() => setView(v)}>
            {tabs[v]}
          </button>
        ))}
      </div>
      <section className="card feed-blocks">
        <header className="card-head">
          <h2>{t.latestBlocks}</h2>
          <span className="head-actions">
            {status}
            <Link href="/blocks">{t.viewAll}</Link>
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
                  {l.txs} {t.txs} · {l.ops} {t.ops}
                </span>
                {l.failed ? <span className="meta">{l.failed} {t.failed}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card feed-activity">
        <header className="card-head">
          <h2>{t.liveActivity}</h2>
          <span className="head-actions">
            {status}
            <Link href="/operations">{t.viewAll}</Link>
          </span>
        </header>
        <div className="tabs filter-tabs" role="tablist" aria-label={t.liveActivity}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? "active" : undefined}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? t.all : kindLabel[f]}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="muted empty">{t.noRecords}</p>
        ) : (
          <ul className="rows activity">
            {rows.slice(0, 14).map((a) => (
              <li key={a.id}>
                <span className={`kind kind-${a.kind}`}>{kindLabel[a.kind]}</span>
                <div className="main-col">
                  <span className="flow">
                    <Acc id={a.from} />
                    {a.to ? (
                      <>
                        <span className="arrow" aria-hidden="true">{lang === "ar" ? "←" : "→"}</span>
                        <Acc id={a.to} />
                      </>
                    ) : null}
                  </span>
                  <span className="meta" suppressHydrationWarning>
                    <Link href={`/tx/${a.tx}`}>
                      <bdi className="mono" dir="ltr">{shortId(a.tx, 4, 4)}</bdi>
                    </Link>{" "}
                    · {timeAgo(a.at, now, lang)}
                  </span>
                </div>
                <div className="side-col">
                  {a.amount ? (
                    <span className="amount">
                      <bdi dir="ltr" className="mono">{formatAmount(a.amount, 4)}</bdi> <span className="asset">{a.asset}</span>
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                  {a.ok ? null : <span className="badge bad">{t.failed}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
