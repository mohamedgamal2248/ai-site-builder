"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountSummary } from "@/lib/account-summary";
import { formatAmount, shortId, timeAgo } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { readWatchlist, writeWatchlist, type WatchEntry } from "@/lib/watchlist";
import { syncPush } from "@/lib/push-client";

export function WatchlistView({ t, lang, native, net }: { t: Dict; lang: "ar" | "en"; native: string; net: string }) {
  const [list, setList] = useState<Record<string, WatchEntry> | null>(null);
  const [data, setData] = useState<Record<string, AccountSummary | "error">>({});

  useEffect(() => {
    const l = readWatchlist();
    setList(l);
    for (const id of Object.keys(l)) {
      fetch(`/api/v1/accounts/${id}?net=${net}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((s: AccountSummary) => setData((d) => ({ ...d, [id]: s })))
        .catch(() => setData((d) => ({ ...d, [id]: "error" })));
    }
  }, [net]);

  if (list === null) return null;
  const ids = Object.keys(list).sort((a, b) => list[b].added - list[a].added);
  if (!ids.length) return <p className="notice">{t.watchlistEmpty}</p>;

  return (
    <ul className="rows watch-rows">
      {ids.map((id) => {
        const s = data[id];
        const fresh = s && s !== "error" && s.last_activity && Date.parse(s.last_activity) > list[id].seenAt;
        return (
          <li key={id} className={fresh ? "is-new" : undefined}>
            <div className="main-col">
              <Link href={`/account/${id}`}>
                <bdi className="mono" dir="ltr">{shortId(id, 6, 6)}</bdi>
              </Link>
              <span className="meta">
                {s === undefined ? "…" : s === "error" ? "—" : s.last_activity ? `${t.lastActivity}: ${timeAgo(s.last_activity, Date.now(), lang)}` : t.none}
                {fresh ? <span className="badge ok" style={{ marginInlineStart: 6 }}>{t.newActivity}</span> : null}
              </span>
            </div>
            <div className="side-col">
              {s && s !== "error" ? (
                <>
                  <span><bdi dir="ltr" className="mono">{formatAmount(s.balance ?? "0", 2)}</bdi> {native}</span>
                  {Number(s.locked) > 0 ? <span className="meta">{t.locked}: <bdi dir="ltr">{formatAmount(s.locked, 0)}</bdi></span> : null}
                </>
              ) : null}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  const l = readWatchlist();
                  delete l[id];
                  writeWatchlist(l);
                  setList({ ...l });
                  syncPush(net).catch(() => {});
                }}
              >
                {t.remove}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
