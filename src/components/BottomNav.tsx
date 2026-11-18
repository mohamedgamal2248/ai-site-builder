"use client";

import Link from "next/link";
import { usePath } from "@/lib/use-path";

const icons = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" />,
  index: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4-5" />
    </>
  ),
  watch: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  unlocks: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.8-1.2" />
      <path d="M12 14v3" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};

function Icon({ k }: { k: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[k]}
    </svg>
  );
}

/** App-style tab bar on phones. Search focuses the header box; Menu opens the drawer. */
export function BottomNav({ labels }: { labels: { home: string; index: string; watch: string; unlocks: string; menu: string } }) {
  const path = usePath();
  const on = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`));
  return (
    <nav className="bottom-nav" aria-label={labels.menu}>
      <Link href="/" className={on("/") ? "active" : undefined} aria-current={on("/") ? "page" : undefined}><Icon k="home" /><span>{labels.home}</span></Link>
      <Link href="/pressure" className={on("/pressure") ? "active" : undefined}><Icon k="index" /><span>{labels.index}</span></Link>
      <Link href="/watchlist" className={on("/watchlist") ? "active" : undefined}><Icon k="watch" /><span>{labels.watch}</span></Link>
      <Link href="/unlocks" className={on("/unlocks") ? "active" : undefined}><Icon k="unlocks" /><span>{labels.unlocks}</span></Link>
      <button type="button" onClick={() => window.dispatchEvent(new Event("bp:menu"))}><Icon k="menu" /><span>{labels.menu}</span></button>
    </nav>
  );
}
