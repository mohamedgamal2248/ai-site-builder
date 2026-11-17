"use client";

import { useEffect, useState } from "react";
import { enablePush, pushEnabled, pushSupported } from "@/lib/push-client";
import { readWatchlist } from "@/lib/watchlist";

type RuleType = "price_above" | "price_below" | "index_below" | "index_above" | "inflow_above" | "foundation" | "inflow_spike";
const WITH_VALUE: RuleType[] = ["price_above", "price_below", "index_below", "index_above", "inflow_above"];
const ORDER: RuleType[] = ["foundation", "inflow_spike", "index_below", "index_above", "price_above", "price_below", "inflow_above"];
const DEFAULTS: Record<RuleType, string> = { price_above: "0.08", price_below: "0.05", index_below: "30", index_above: "70", inflow_above: "5000000", foundation: "", inflow_spike: "" };
const KEY = "bp-alert-rules";

interface Labels {
  ruleTypes: Record<RuleType, string>;
  save: string;
  saved: string;
  enableFirst: string;
  unsupported: string;
  notify: string;
}

export function RulesForm({ net, labels }: { net: string; labels: Labels }) {
  const [on, setOn] = useState<Record<RuleType, boolean>>({ foundation: true, inflow_spike: true, index_below: false, index_above: false, price_above: false, price_below: false, inflow_above: false });
  const [values, setValues] = useState<Record<RuleType, string>>(DEFAULTS);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "need" | "unsupported">("idle");

  useEffect(() => {
    if (!pushSupported()) setState("unsupported");
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { on: typeof on; values: typeof values } | null;
      if (saved) {
        setOn(saved.on);
        setValues({ ...DEFAULTS, ...saved.values });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const save = async () => {
    setState("busy");
    if (!(await pushEnabled())) {
      const r = await enablePush(net);
      if (r !== "on") return setState(r === "unsupported" ? "unsupported" : "need");
    }
    const rules = ORDER.filter((t) => on[t]).map((t) => (WITH_VALUE.includes(t) ? { type: t, value: Number(values[t]) } : { type: t }));
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return setState("need");
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), addresses: Object.keys(readWatchlist()), net, rules }),
    });
    try {
      localStorage.setItem(KEY, JSON.stringify({ on, values }));
    } catch {
      /* ignore */
    }
    setState("saved");
  };

  if (state === "unsupported") return <p className="notice">{labels.unsupported}</p>;
  return (
    <div className="rules">
      {ORDER.map((t) => (
        <label key={t} className="rule">
          <input type="checkbox" checked={on[t]} onChange={(e) => setOn({ ...on, [t]: e.target.checked })} />
          <span>{labels.ruleTypes[t]}</span>
          {WITH_VALUE.includes(t) ? (
            <input
              type="number"
              inputMode="decimal"
              dir="ltr"
              value={values[t]}
              step="any"
              min="0"
              onChange={(e) => setValues({ ...values, [t]: e.target.value })}
              disabled={!on[t]}
              aria-label={labels.ruleTypes[t]}
            />
          ) : null}
        </label>
      ))}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
        <button type="button" className="btn" onClick={save} disabled={state === "busy"}>
          {state === "saved" ? `✓ ${labels.saved}` : labels.save}
        </button>
        {state === "need" ? <span className="muted">{labels.enableFirst}</span> : null}
      </div>
    </div>
  );
}
