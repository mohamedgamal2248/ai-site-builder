"use client";

import { useEffect, useState } from "react";
import { Logo } from "./Logo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const KEY = "bp-install";

/**
 * "Add to home screen" banner from the second visit on. Uses the browser's install prompt where
 * there is one (Android/desktop Chrome); on iPhone it shows the Share → Add to Home Screen hint.
 * Dismissing hides it for 30 days.
 */
export function InstallPrompt({ labels }: { labels: { title: string; text: string; ios: string; install: string; later: string } }) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let state = { visits: 0, hideUntil: 0 };
    try {
      state = { ...state, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
      state.visits += 1;
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      return;
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone || state.visits < 2 || state.hideUntil > Date.now()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)) {
      setIos(true);
      setShow(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const hide = () => {
    setShow(false);
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      localStorage.setItem(KEY, JSON.stringify({ ...s, hideUntil: Date.now() + 30 * 86_400_000 }));
    } catch {
      /* ignore */
    }
  };

  if (!show) return null;
  return (
    <div className="install" role="dialog" aria-label={labels.title}>
      <Logo size={38} />
      <div className="install-text">
        <strong>{labels.title}</strong>
        <span>{ios ? labels.ios : labels.text}</span>
      </div>
      {evt ? (
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice.catch(() => null);
            hide();
          }}
        >
          {labels.install}
        </button>
      ) : null}
      <button type="button" className="install-x" aria-label={labels.later} onClick={hide}>✕</button>
    </div>
  );
}
