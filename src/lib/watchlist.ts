/** Browser-only watchlist: { [accountId]: { added, seenAt } } in localStorage. */
export interface WatchEntry {
  added: number;
  seenAt: number;
}

const KEY = "bp-watchlist";

export function readWatchlist(): Record<string, WatchEntry> {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Record<string, WatchEntry>) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function writeWatchlist(list: Record<string, WatchEntry>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage blocked: the watchlist simply does not persist */
  }
}
