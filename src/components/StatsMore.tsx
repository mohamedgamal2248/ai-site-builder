"use client";

import { useState, type ReactNode } from "react";

/** Phones show the first four stats with a "More" toggle; wider screens show all of them. */
export function StatsMore({ children, labels }: { children: ReactNode; labels: { more: string; less: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`stats-more${open ? " open" : ""}`}>
      <div className="stats eight">{children}</div>
      <button type="button" className="more-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? labels.less : labels.more}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </div>
  );
}
