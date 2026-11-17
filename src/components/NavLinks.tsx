"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Main navigation with the current section highlighted and scrolled into view on phones. */
export function NavLinks({ items }: { items: [string, string][] }) {
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`) || (href === "/txs" && path.startsWith("/tx/"));

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("a.active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [path]);

  return (
    <div className="container nav-inner" ref={ref}>
      {items.map(([href, label]) => (
        <Link key={href} href={href} className={isActive(href) ? "active" : undefined} aria-current={isActive(href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </div>
  );
}
