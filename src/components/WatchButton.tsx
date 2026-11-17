"use client";

import { useEffect, useState } from "react";
import { readWatchlist, writeWatchlist } from "@/lib/watchlist";
import { syncPush } from "@/lib/push-client";

/** ☆ Watch / ★ Watching toggle. Visiting the account marks its activity as seen. */
export function WatchButton({ id, labels }: { id: string; labels: { watch: string; unwatch: string } }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const list = readWatchlist();
    if (list[id]) {
      list[id].seenAt = Date.now();
      writeWatchlist(list);
      setOn(true);
    }
  }, [id]);

  return (
    <button
      type="button"
      className={`watch-btn${on ? " on" : ""}`}
      aria-pressed={on}
      onClick={() => {
        const list = readWatchlist();
        if (list[id]) delete list[id];
        else list[id] = { added: Date.now(), seenAt: Date.now() };
        writeWatchlist(list);
        setOn(!!list[id]);
        syncPush(document.cookie.includes("net=testnet") ? "testnet" : "mainnet").catch(() => {});
      }}
    >
      {on ? labels.unwatch : labels.watch}
    </button>
  );
}
