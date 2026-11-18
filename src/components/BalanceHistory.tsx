"use client";

import { useEffect, useRef, useState } from "react";
import { LineChart, type Point } from "./LineChart";

interface Effect {
  type: string;
  created_at: string;
  amount?: string;
  asset_type?: string;
  starting_balance?: string;
  sold_asset_type?: string;
  sold_amount?: string;
  bought_asset_type?: string;
  bought_amount?: string;
}

/** How much one effect changed the native balance (credit positive, debit negative). */
function delta(e: Effect): number {
  switch (e.type) {
    case "account_created":
      return Number(e.starting_balance ?? 0);
    case "account_credited":
      return e.asset_type === "native" ? Number(e.amount ?? 0) : 0;
    case "account_debited":
      return e.asset_type === "native" ? -Number(e.amount ?? 0) : 0;
    case "trade":
      return (e.bought_asset_type === "native" ? Number(e.bought_amount ?? 0) : 0) - (e.sold_asset_type === "native" ? Number(e.sold_amount ?? 0) : 0);
    default:
      return 0;
  }
}

const PAGES = 5;

/**
 * Balance over time, rebuilt in the browser from the account's effects on Horizon (newest
 * first, walking back from today's balance). Costs the server nothing; loads when scrolled to.
 */
export function BalanceHistory({ id, host, balance, locale, ariaLabel, labels }: { id: string; host: string; balance: number; locale: string; ariaLabel: string; labels: { loading: string; empty: string; note: string; partial: string } }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ points: Point[]; partial: boolean } | "loading" | "idle" | "error">("idle");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    const load = async () => {
      setState("loading");
      try {
        const effects: Effect[] = [];
        let url: string | null = `${host}/accounts/${id}/effects?order=desc&limit=200`;
        let partial = false;
        for (let i = 0; url && i < PAGES; i++) {
          const r: Response = await fetch(url);
          if (!r.ok) throw new Error(String(r.status));
          const j = await r.json();
          const recs: Effect[] = j._embedded?.records ?? [];
          effects.push(...recs);
          url = recs.length === 200 ? (j._links?.next?.href as string) : null;
          if (url && i === PAGES - 1) partial = true;
        }
        if (cancelled) return;
        // Walk back from the current balance; one point per change, plus "now".
        const points: Point[] = [{ t: Date.now(), v: balance }];
        let v = balance;
        for (const e of effects) {
          const d = delta(e);
          if (!d) continue;
          const t = Date.parse(e.created_at);
          points.push({ t, v });
          v -= d;
          points.push({ t: t - 1, v: Math.max(0, v) });
        }
        points.reverse();
        setState({ points, partial });
      } catch {
        if (!cancelled) setState("error");
      }
    };
    const io = new IntersectionObserver((es) => {
      if (es.some((x) => x.isIntersecting)) {
        io.disconnect();
        load();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [id, host, balance]);

  return (
    <div ref={box} className="balance-history" aria-busy={state === "loading"}>
      {typeof state === "object" ? (
        state.points.length > 2 ? (
          <>
            <LineChart
              points={state.points}
              decimals={2}
              locale={locale}
              // A busy wallet's last 1,000 changes can all fall on one day: label hours then.
              timeMode={state.points[state.points.length - 1].t - state.points[0].t < 2 * 86_400_000 ? "dayhour" : "day"}
              ariaLabel={ariaLabel}
            />
            <p className="muted chart-note">{state.partial ? labels.partial : labels.note}</p>
          </>
        ) : (
          <p className="muted">{labels.empty}</p>
        )
      ) : state === "error" ? (
        <p className="muted">—</p>
      ) : (
        <div className="skeleton-chart" role="status" aria-label={labels.loading} />
      )}
    </div>
  );
}
