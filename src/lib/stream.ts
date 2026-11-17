/**
 * Live Horizon streams (Server-Sent Events) straight from the browser, shared by every component
 * on the page: one connection per collection, opened on first use and closed when nobody listens.
 * Pi's Horizon pushes each new ledger and operation as it closes, so nothing waits on a poll.
 */
import type { Ledger, Operation } from "./horizon";

type Kind = "ledgers" | "operations";
type Rec<K extends Kind> = K extends "ledgers" ? Ledger : Operation;
type State = "connecting" | "open" | "down";

interface Stream {
  es: EventSource;
  subs: Set<(r: never) => void>;
  states: Set<(s: State) => void>;
  errors: number;
}

const streams = new Map<string, Stream>();

export function subscribeHorizon<K extends Kind>(host: string, kind: K, onRecord: (r: Rec<K>) => void, onState?: (s: State) => void): () => void {
  if (typeof EventSource === "undefined") {
    onState?.("down");
    return () => {};
  }
  const key = `${host}|${kind}`;
  let st = streams.get(key);
  if (!st) {
    const url = `${host}/${kind}?cursor=now${kind === "operations" ? "&include_failed=true" : ""}`;
    const es = new EventSource(url);
    const created: Stream = { es, subs: new Set(), states: new Set(), errors: 0 };
    es.onopen = () => {
      created.errors = 0;
      created.states.forEach((f) => f("open"));
    };
    es.onmessage = (e) => {
      if (!e.data || e.data === '"hello"' || e.data === '"byebye"') return;
      try {
        const rec = JSON.parse(e.data) as never;
        created.subs.forEach((f) => f(rec));
      } catch {
        /* skip a bad frame */
      }
    };
    es.onerror = () => {
      created.errors++;
      // EventSource reconnects by itself; after a few failures tell listeners to fall back.
      created.states.forEach((f) => f(created.errors >= 3 || es.readyState === EventSource.CLOSED ? "down" : "connecting"));
    };
    streams.set(key, created);
    st = created;
  }
  const s = st;
  s.subs.add(onRecord as (r: never) => void);
  if (onState) {
    s.states.add(onState);
    onState(s.es.readyState === EventSource.OPEN ? "open" : "connecting");
  }
  return () => {
    s.subs.delete(onRecord as (r: never) => void);
    if (onState) s.states.delete(onState);
    if (!s.subs.size) {
      s.es.close();
      streams.delete(key);
    }
  };
}
