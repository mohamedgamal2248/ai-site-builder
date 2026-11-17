"use client";

import { useEffect, useState } from "react";
import { enablePush, pushEnabled, pushSupported } from "@/lib/push-client";

export function NotifyButton({ net, labels }: { net: string; labels: { notify: string; on: string; blocked: string } }) {
  const [state, setState] = useState<"idle" | "on" | "denied" | "unsupported" | "busy">("idle");
  useEffect(() => {
    if (!pushSupported()) setState("unsupported");
    else pushEnabled().then((on) => on && setState("on"));
  }, []);
  if (state === "unsupported") return null;
  return (
    <button
      type="button"
      className={`watch-btn${state === "on" ? " on" : ""}`}
      disabled={state === "busy" || state === "on"}
      onClick={async () => {
        setState("busy");
        setState(await enablePush(net));
      }}
    >
      {state === "on" ? labels.on : state === "denied" ? labels.blocked : labels.notify}
    </button>
  );
}
