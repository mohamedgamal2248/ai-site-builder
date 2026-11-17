"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };

const read = (): Theme => {
  const m = document.cookie.match(/(?:^|; )theme=(auto|light|dark)/);
  return (m?.[1] as Theme) ?? "auto";
};

/** Theme lives in the browser (cookie + data-theme), so pages stay identical and cacheable. */
export function ThemeToggle({ labels }: { labels: { theme: string; auto: string; light: string; dark: string } }) {
  const [theme, setTheme] = useState<Theme>("auto");
  useEffect(() => setTheme(read()), []);
  const set = () => {
    const next = NEXT[theme];
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    if (next === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    setTheme(next);
  };
  const label = `${labels.theme}: ${labels[theme]}`;
  return (
    <button type="button" className="icon-pill" onClick={set} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {theme === "auto" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 1 0 0 18V3Z" fill="currentColor" stroke="none" />
          </>
        ) : theme === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        )}
      </svg>
    </button>
  );
}
