import Link from "next/link";
import type { Settings } from "@/lib/settings";

export function Header({ s }: { s: Settings }) {
  const { t, lang, net } = s;
  const nav: [string, string][] = [
    ["/", t.home],
    ["/blocks", t.blocks],
    ["/txs", t.transactions],
    ["/operations", t.operations],
    ["/locked", t.locked],
    ["/trades", t.trades],
    ["/assets", t.assets],
    ["/pools", t.pools],
  ];
  return (
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
            {net === "mainnet" ? t.mainnet : t.testnet}
          </a>
          <a className="lang-pill" href={`/settings?k=lang&v=${lang === "ar" ? "en" : "ar"}`} lang={lang === "ar" ? "en" : "ar"}>
            {t.language}
          </a>
        </div>
      </div>
      <div className="container">
        <form action="/search" method="get" className="search" role="search">
          <input name="q" type="search" placeholder={t.searchPlaceholder} aria-label={t.search} autoComplete="off" spellCheck={false} dir="auto" required />
          <button type="submit">{t.search}</button>
        </form>
      </div>
      <nav className="main-nav" aria-label="Main">
        <div className="container nav-inner">
          {nav.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
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
