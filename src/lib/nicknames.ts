/**
 * Private nicknames for wallets ("my wallet", "my friend"), kept only in this browser.
 * A tiny shared store so every link on the page updates when a name changes.
 */
const KEY = "bp-nicknames";
const listeners = new Set<() => void>();
let cache: Record<string, string> | null = null;

export function readNicknames(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    cache = {};
  }
  return cache as Record<string, string>;
}

export function setNickname(id: string, name: string) {
  const next = { ...readNicknames() };
  const clean = name.trim().slice(0, 32);
  if (clean) next[id] = clean;
  else delete next[id];
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l());
}

export function subscribeNicknames(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}
