"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icons = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" />,
  index: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  alerts: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
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
export function BottomNav({ labels }: { labels: { home: string; index: string; search: string; alerts: string; menu: string } }) {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`));
  const focusSearch = () => window.dispatchEvent(new Event("bp:search"));
  return (
    <nav className="bottom-nav" aria-label={labels.menu}>
      <Link href="/" className={on("/") ? "active" : undefined} aria-current={on("/") ? "page" : undefined}><Icon k="home" /><span>{labels.home}</span></Link>
      <Link href="/pressure" className={on("/pressure") ? "active" : undefined}><Icon k="index" /><span>{labels.index}</span></Link>
      <button type="button" onClick={focusSearch}><Icon k="search" /><span>{labels.search}</span></button>
      <Link href="/alerts" className={on("/alerts") ? "active" : undefined}><Icon k="alerts" /><span>{labels.alerts}</span></Link>
      <button type="button" onClick={() => window.dispatchEvent(new Event("bp:menu"))}><Icon k="menu" /><span>{labels.menu}</span></button>
    </nav>
  );
}
