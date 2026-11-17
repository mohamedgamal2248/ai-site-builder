import Link from "next/link";
import type { Settings } from "@/lib/settings";
import { NavLinks } from "./NavLinks";

export function Header({ s }: { s: Settings }) {
  const { t, lang, net } = s;
  const nav: [string, string][] = [
    ["/", t.home],
    ["/blocks", t.blocks],
    ["/txs", t.transactions],
    ["/operations", t.operations],
    ["/stats", t.stats],
    ["/unlocks", t.unlocks],
    ["/largest", t.largest],
    ["/locked", t.locked],
    ["/wallets", t.wallets],
    ["/trades", t.trades],
    ["/assets", t.assets],
    ["/pools", t.pools],
  ];
  return (
    <>
    <header className="site-header">
      <div className="container header-top">
        <Link href="/" className="brand" aria-label={t.siteName}>
          <span className="logo" aria-hidden="true">π</span>
          <span className="brand-text">
            <strong dir="ltr">{t.siteName}</strong>
            <small>{t.tagline}</small>
          </span>
        </Link>
        <div className="toggles">
          <a
            className={`net-pill ${net}`}
            href={`/settings?k=net&v=${net === "mainnet" ? "testnet" : "mainnet"}`}
            title={t.network}
          >
            <span className="dot" aria-hidden="true" />
            <span className="net-long">{net === "mainnet" ? t.mainnet : t.testnet}</span>
            <span className="net-short" dir="ltr">{net === "mainnet" ? "Mainnet" : "Testnet"}</span>
          </a>
          <a className="lang-pill" href={`/settings?k=lang&v=${lang === "ar" ? "en" : "ar"}`} lang={lang === "ar" ? "en" : "ar"}>
            {t.language}
          </a>
        </div>
      </div>
      <div className="container">
        <form action="/search" method="get" className="search" role="search">
          <input name="q" type="search" placeholder={t.searchShort} aria-label={t.search} autoComplete="off" spellCheck={false} dir="auto" required />
          <button type="submit" aria-label={t.search} title={t.search}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </form>
      </div>
    </header>
    <nav className="main-nav" aria-label="Main">
      <NavLinks items={nav} />
    </nav>
    </>
  );
}

export function Footer({ s }: { s: Settings }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>{s.t.disclaimer}</p>
        <p className="muted" dir="ltr">© {new Date().getUTCFullYear()} Blockchain Pi</p>
      </div>
    </footer>
  );
}
