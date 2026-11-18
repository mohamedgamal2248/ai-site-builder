"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { knownWallets } from "@/data/wallets";
import { classifySearch, shortId } from "@/lib/format";
import { WalletBadge } from "./WalletBadge";

interface Labels {
  placeholder: string;
  pages: string;
  wallets: string;
  recent: string;
  open: string;
  block: string;
  tx: string;
  account: string;
  search: string;
  empty: string;
  hint: string;
  clear: string;
}

interface Item {
  key: string;
  group: string;
  title: string;
  sub?: string;
  href: string;
  icon?: React.ReactNode;
}

const RECENT = "bp-recent";
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? "[]");
  } catch {
    return [];
  }
};

/**
 * Spotlight-style search (Ctrl/⌘ K, or the Search tab on phones): jumps straight to a block,
 * transaction or account as you type, and finds pages and known wallets. Runs in the browser.
 */
export function CommandPalette({ labels, pages, lang }: { labels: Labels; pages: [string, string][]; lang: "ar" | "en" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("bp:search", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("bp:search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    setQ("");
    setSel(0);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => input.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const term = q.trim();
    const low = term.toLowerCase();
    const out: Item[] = [];
    if (term) {
      const k = classifySearch(term);
      if (k.kind === "ledger") out.push({ key: "d", group: labels.open, title: `${labels.block} #${Number(k.value).toLocaleString("en")}`, href: `/blocks/${k.value}` });
      else if (k.kind === "tx") out.push({ key: "d", group: labels.open, title: labels.tx, sub: shortId(k.value, 10, 10), href: `/tx/${k.value}` });
      else if (k.kind === "account" || k.kind === "muxed") out.push({ key: "d", group: labels.open, title: labels.account, sub: shortId(k.value, 8, 8), href: `/account/${k.value}${k.kind === "muxed" ? `?muxed=${encodeURIComponent(term)}` : ""}` });
      out.push({ key: "s", group: labels.open, title: `${labels.search}: “${term}”`, href: `/search?q=${encodeURIComponent(term)}` });
    }
    const wallets = knownWallets
      .filter((w) => !low || w.label.toLowerCase().includes(low) || w.labelAr.includes(term) || w.address.toLowerCase().startsWith(low))
      .slice(0, term ? 6 : 4)
      .map<Item>((w) => ({ key: w.address, group: labels.wallets, title: (lang === "ar" ? w.labelAr : w.label).split(" · ")[0], sub: shortId(w.address, 5, 5), href: `/account/${w.address}`, icon: <WalletBadge logo={w.logo} size={18} /> }));
    const pageHits = pages
      .filter(([, label]) => !low || label.toLowerCase().includes(low))
      .slice(0, term ? 6 : 8)
      .map<Item>(([href, label]) => ({ key: href, group: labels.pages, title: label, href }));
    const recents = term ? [] : recent.slice(0, 5).map<Item>((r) => ({ key: `r${r}`, group: labels.recent, title: r.length > 30 ? shortId(r, 10, 8) : r, href: `/search?q=${encodeURIComponent(r)}` }));
    return [...out, ...recents, ...wallets, ...pageHits];
  }, [q, recent, pages, labels, lang]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    const term = q.trim();
    if (term && (it.key === "d" || it.key === "s")) {
      const next = [term, ...readRecent().filter((r) => r !== term)].slice(0, 8);
      try {
        localStorage.setItem(RECENT, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    router.push(it.href);
  };

  if (!open) return null;
  let lastGroup = "";
  return (
    <div className="cmdk-wrap" onClick={() => setOpen(false)}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label={labels.placeholder} onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            value={q}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(items.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(items[sel]);
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="cmdk-list" role="listbox">
          {items.length === 0 ? <li className="cmdk-empty">{labels.empty}</li> : null}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={it.key} role="presentation">
                {head ? <div className="cmdk-group">{head}</div> : null}
                <button type="button" role="option" aria-selected={i === sel} className={i === sel ? "on" : undefined} onMouseEnter={() => setSel(i)} onClick={() => go(it)}>
                  {it.icon ?? <span className="cmdk-dot" aria-hidden="true" />}
                  <span className="cmdk-title">{it.title}</span>
                  {it.sub ? <bdi className="mono cmdk-sub" dir="ltr">{it.sub}</bdi> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="cmdk-foot">
          <span>{labels.hint}</span>
          {recent.length ? (
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(RECENT);
                } catch {
                  /* ignore */
                }
                setRecent([]);
              }}
            >
              {labels.clear}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
