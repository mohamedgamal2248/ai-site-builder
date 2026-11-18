"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { classifySearch } from "@/lib/format";
import { Logo } from "./Logo";

const T = {
  ar: {
    title: "الصفحة دي مش موجودة",
    text: "الرابط غلط أو اتشال، أو القيمة مش موجودة على الشبكة المختارة.",
    looks: "الرابط شكله فيه رقم أو عنوان. جرّب تبحث عنه:",
    search: "ابحث برقم بلوك أو معاملة أو حساب",
    go: "بحث",
    home: "الرئيسية",
    blocks: "البلوكات",
    txs: "المعاملات",
    index: "مؤشر الضغط",
    net: "لو الرابط من الشبكة التجريبية، غيّر الشبكة من فوق.",
  },
  en: {
    title: "This page doesn't exist",
    text: "The link is wrong or was removed, or the value isn't on the selected network.",
    looks: "The link seems to contain a number or address. Try searching for it:",
    search: "Block, transaction or account",
    go: "Search",
    home: "Home",
    blocks: "Blocks",
    txs: "Transactions",
    index: "Pressure index",
    net: "If the link is from the testnet, switch the network at the top.",
  },
};

/** Friendly 404: says what happened, offers search (prefilled when the link held an ID) and the main pages. */
export function NotFoundView() {
  const params = useParams<{ s?: string }>();
  const path = usePathname() ?? "";
  const lang = String(params?.s ?? "").startsWith("en") ? "en" : "ar";
  const t = T[lang];
  const last = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
  // Only suggest a search when the link really held a block number, hash or address.
  const guess = last && ["ledger", "tx", "account", "muxed", "claimable"].includes(classifySearch(last).kind) ? last : "";

  return (
    <section className="nf" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="nf-art" aria-hidden="true">
        <span>4</span>
        <span className="nf-pi nf-mark"><Logo size={84} className="nf-logo" /></span>
        <span>4</span>
      </div>
      <h1>{t.title}</h1>
      <p className="muted">{t.text}</p>
      {guess ? <p className="nf-hint">{t.looks}</p> : null}
      <form action="/search" method="get" className="search nf-search" role="search">
        <input type="search" name="q" defaultValue={guess} placeholder={t.search} aria-label={t.search} required autoComplete="off" spellCheck={false} />
        <button type="submit" aria-label={t.go} title={t.go}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </button>
      </form>
      <nav className="nf-links">
        <Link href="/" className="btn">{t.home}</Link>
        <Link href="/blocks" className="btn ghost">{t.blocks}</Link>
        <Link href="/txs" className="btn ghost">{t.txs}</Link>
        <Link href="/pressure" className="btn ghost">{t.index}</Link>
      </nav>
      <p className="muted nf-note">{t.net}</p>
    </section>
  );
}
