"use client";

import { useEffect, useState } from "react";
import { readWatchlist, writeWatchlist } from "@/lib/watchlist";
import { readNicknames, setNickname } from "@/lib/nicknames";
import { syncPush } from "@/lib/push-client";

interface Payload {
  w: string[];
  n: Record<string, string>;
}

const ID = /^G[A-Z2-7]{55}$/;

const encode = (p: Payload) => {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function decode(code: string): Payload | null {
  try {
    const raw = code.includes("import=") ? code.slice(code.indexOf("import=") + 7) : code;
    const b64 = raw.trim().replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Payload;
    const w = Array.isArray(p.w) ? p.w.filter((x) => typeof x === "string" && ID.test(x)).slice(0, 200) : [];
    const n: Record<string, string> = {};
    if (p.n && typeof p.n === "object") for (const [k, v] of Object.entries(p.n)) if (ID.test(k) && typeof v === "string") n[k] = v.slice(0, 32);
    return w.length || Object.keys(n).length ? { w, n } : null;
  } catch {
    return null;
  }
}

export interface TransferLabels {
  title: string;
  intro: string;
  show: string;
  hide: string;
  copy: string;
  copied: string;
  paste: string;
  pasteHint: string;
  import: string;
  /** "{n}" is replaced with the number of wallets. */
  confirm: string;
  done: string;
  bad: string;
  empty: string;
}

/**
 * Moves the watchlist and private wallet names to another device with no account: the data
 * travels inside a link (after #, so it never reaches the server) shown as text and a QR code.
 */
export function WatchTransfer({ net, labels: L }: { net: string; labels: TransferLabels }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");

  const apply = (p: Payload) => {
    const list = readWatchlist();
    let added = 0;
    for (const id of p.w) {
      if (!list[id]) {
        list[id] = { added: Date.now(), seenAt: Date.now() };
        added++;
      }
    }
    writeWatchlist(list);
    for (const [id, name] of Object.entries(p.n)) setNickname(id, name);
    syncPush(net).catch(() => {});
    return added;
  };

  // Arriving from a transfer link: ask, then merge and reload the list.
  useEffect(() => {
    const h = location.hash;
    if (!h.includes("import=")) return;
    const p = decode(h);
    history.replaceState(null, "", location.pathname + location.search);
    if (!p) return setMsg(L.bad);
    if (window.confirm(L.confirm.replace("{n}", String(p.w.length)))) {
      apply(p);
      location.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const build = async () => {
    const w = Object.keys(readWatchlist());
    const all = readNicknames();
    const n: Record<string, string> = {};
    for (const [k, v] of Object.entries(all)) n[k] = v;
    if (!w.length && !Object.keys(n).length) {
      setMsg(L.empty);
      return;
    }
    const url = `${location.origin}/watchlist#import=${encode({ w, n })}`;
    setLink(url);
    const QR = (await import("qrcode")).default;
    setQr(await QR.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "L" }));
    setOpen(true);
    setMsg("");
  };

  return (
    <div className="transfer-box">
      <div>
        <strong>{L.title}</strong>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>{L.intro}</p>
      </div>
      <div className="transfer-actions">
        <button type="button" className="btn-ghost" onClick={() => (open ? setOpen(false) : build())} aria-expanded={open}>
          {open ? L.hide : L.show}
        </button>
      </div>
      {open && link ? (
        <>
          <div className="qr-big" role="img" aria-label={L.title} dangerouslySetInnerHTML={{ __html: qr }} />
          <textarea readOnly value={link} aria-label={L.title} onFocus={(e) => e.currentTarget.select()} dir="ltr" />
          <div className="transfer-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                navigator.clipboard?.writeText(link).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? L.copied : L.copy}
            </button>
          </div>
        </>
      ) : null}
      <form
        className="transfer-actions"
        onSubmit={(e) => {
          e.preventDefault();
          const p = decode(paste);
          if (!p) return setMsg(L.bad);
          const n = apply(p);
          setMsg(L.done.replace("{n}", String(n)));
          setPaste("");
          setTimeout(() => location.reload(), 900);
        }}
      >
        <label className="sr-only" htmlFor="wt-paste">{L.paste}</label>
        <input id="wt-paste" className="input" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={L.pasteHint} dir="ltr" style={{ flex: 1, minWidth: 200 }} />
        <button type="submit" className="btn-ghost" disabled={!paste.trim()}>{L.import}</button>
      </form>
      {msg ? <p className="notice" role="status" style={{ margin: 0 }}>{msg}</p> : null}
    </div>
  );
}
