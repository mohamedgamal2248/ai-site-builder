"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface NavGroup {
  label: string;
  items: [string, string][];
}

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`) || (href === "/txs" && path.startsWith("/tx/"));
}

/** Desktop: grouped dropdowns. Phones: a few quick links plus a ☰ drawer with everything. */
export function NavMenu({ home, groups, quick, labels }: { home: string; groups: NavGroup[]; quick: [string, string][]; labels: { menu: string; close: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState<number | null>(null);
  const [drawer, setDrawer] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(null);
    setDrawer(false);
  }, [path]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setDrawer(false);
      }
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
  }, [drawer]);

  return (
    <>
      {/* Desktop */}
      <div className="container nav-desktop" ref={bar}>
        <Link href="/" className={`nav-item${isActive(path, "/") ? " active" : ""}`}>{home}</Link>
        {groups.map((g, i) => {
          const groupActive = g.items.some(([h]) => isActive(path, h));
          return (
            <div className="nav-group" key={g.label}>
              <button
                type="button"
                className={`nav-item${groupActive ? " active" : ""}`}
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {g.label} <span aria-hidden="true" className="caret">▾</span>
              </button>
              {open === i ? (
                <div className="dropdown" role="menu">
                  {g.items.map(([href, label]) => (
                    <Link key={href} href={href} role="menuitem" className={isActive(path, href) ? "active" : undefined}>
                      {label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Phones */}
      <div className="container nav-mobile">
        <div className="nav-quick">
          {quick.map(([href, label]) => (
            <Link key={href} href={href} className={isActive(path, href) ? "active" : undefined}>{label}</Link>
          ))}
        </div>
        <button type="button" className="menu-btn" aria-label={labels.menu} aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
      {drawer ? (
        <div className="drawer-wrap" onClick={() => setDrawer(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={labels.menu} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <strong>{labels.menu}</strong>
              <button type="button" className="menu-btn" aria-label={labels.close} onClick={() => setDrawer(false)}>✕</button>
            </div>
            <Link href="/" className={`drawer-link${isActive(path, "/") ? " active" : ""}`}>{home}</Link>
            {groups.map((g) => (
              <div key={g.label} className="drawer-group">
                <div className="drawer-title">{g.label}</div>
                {g.items.map(([href, label]) => (
                  <Link key={href} href={href} className={`drawer-link${isActive(path, href) ? " active" : ""}`}>{label}</Link>
                ))}
              </div>
            ))}
          </aside>
        </div>
      ) : null}
    </>
  );
}
