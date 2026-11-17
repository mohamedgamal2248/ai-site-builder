"use client";

import { useEffect, useRef, useState } from "react";
import { classifySearch } from "@/lib/format";

interface Labels {
  search: string;
  placeholder: string;
  ledger: string;
  tx: string;
  account: string;
  asset: string;
  unknown: string;
}

/** Search box with a live "this looks like…" hint and the "/" shortcut. Works without JavaScript too. */
export function SearchBox({ labels }: { labels: Labels }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const kind = q.trim() ? classifySearch(q).kind : null;
  const hint =
    kind === "ledger" ? labels.ledger
    : kind === "tx" ? labels.tx
    : kind === "account" ? labels.account
    : kind === "asset" ? labels.asset
    : kind === "claimable" ? labels.tx
    : kind === "unknown" ? labels.unknown
    : null;

  return (
    <form action="/search" method="get" className="search" role="search">
      <input
        ref={input}
        name="q"
        type="search"
        placeholder={labels.placeholder}
        aria-label={labels.search}
        autoComplete="off"
        spellCheck={false}
        required
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <kbd className="kbd" aria-hidden="true">/</kbd>
      <button type="submit" aria-label={labels.search} title={labels.search}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
      {hint ? (
        <div className={`search-hint${kind === "unknown" ? " bad" : ""}`} role="status">
          {kind !== "unknown" ? "↵ " : ""}
          {hint}
        </div>
      ) : null}
    </form>
  );
}
