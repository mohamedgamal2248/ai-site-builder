import Link from "next/link";
import type { Settings } from "@/lib/settings";
import { NavMenu } from "./NavMenu";
import { SearchBox } from "./SearchBox";

const NEXT_THEME = { auto: "light", light: "dark", dark: "auto" } as const;

export function Header({ s }: { s: Settings }) {
  const { t, lang, net, theme } = s;
  const groups = [
    { label: t.groupChain, items: [["/blocks", t.blocks], ["/txs", t.transactions], ["/operations", t.operations]] as [string, string][] },
    { label: t.groupStats, items: [["/stats", t.stats], ["/flows", t.flows], ["/whales", t.whales], ["/supply", t.supply], ["/unlocks", t.unlocks], ["/largest", t.largest], ["/locked", t.locked]] as [string, string][] },
    { label: t.groupTokens, items: [["/assets", t.assets], ["/pools", t.pools], ["/trades", t.trades]] as [string, string][] },
    { label: t.groupTools, items: [["/wallets", t.wallets], ["/richlist", t.richlist], ["/watchlist", t.watchlist], ["/api-docs", t.apiDocs], ["/status", t.status]] as [string, string][] },
  ];
  const quick: [string, string][] = [["/", t.home], ["/whales", t.whales], ["/flows", t.flows], ["/txs", t.transactions], ["/unlocks", t.unlocks]];
  const themeLabel = { auto: t.themeAuto, light: t.themeLight, dark: t.themeDark }[theme];
  const themeIcon = {
    auto: <path d="M12 3a9 9 0 1 0 0 18V3Z" fill="currentColor" stroke="none" />,
    light: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  }[theme];

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
            <a className="icon-pill" href={`/settings?k=theme&v=${NEXT_THEME[theme]}`} title={`${t.theme}: ${themeLabel}`} aria-label={`${t.theme}: ${themeLabel}`}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {theme === "auto" ? <circle cx="12" cy="12" r="9" /> : null}
                {themeIcon}
              </svg>
            </a>
            <a className={`net-pill ${net}`} href={`/settings?k=net&v=${net === "mainnet" ? "testnet" : "mainnet"}`} title={t.network}>
              <span className="dot" aria-hidden="true" />
              <span className="net-long">{net === "mainnet" ? t.mainnet : t.testnet}</span>
              <span className="net-short" dir="ltr">{net === "mainnet" ? "Main" : "Test"}</span>
            </a>
            <a className="lang-pill" href={`/settings?k=lang&v=${lang === "ar" ? "en" : "ar"}`} lang={lang === "ar" ? "en" : "ar"}>
              <span className="net-long">{t.language}</span>
              <span className="net-short">{lang === "ar" ? "EN" : "ع"}</span>
            </a>
          </div>
        </div>
        <div className="container">
          <SearchBox
            labels={{
              search: t.search,
              placeholder: t.searchShort,
              ledger: t.searchHintLedger,
              tx: t.searchHintTx,
              account: t.searchHintAccount,
              asset: t.searchHintAsset,
              unknown: t.searchHintUnknown,
            }}
          />
        </div>
      </header>
      <nav className="main-nav" aria-label="Main">
        <NavMenu home={t.home} groups={groups} quick={quick} labels={{ menu: t.menu, close: t.close }} />
      </nav>
    </>
  );
}

export function Footer({ s }: { s: Settings }) {
  const { t } = s;
  const cols: [string, [string, string][]][] = [
    [t.footerExplore, [["/blocks", t.blocks], ["/txs", t.transactions], ["/operations", t.operations], ["/assets", t.assets]]],
    [t.footerStats, [["/stats", t.stats], ["/flows", t.flows], ["/whales", t.whales], ["/supply", t.supply], ["/unlocks", t.unlocks]]],
    [t.footerDevelopers, [["/api-docs", t.apiDocs], ["https://github.com/mohamedgamal2248/ai-site-builder", t.sourceCode], ["https://api.mainnet.minepi.com", t.dataSource]]],
    [t.groupTools, [["/wallets", t.wallets], ["/richlist", t.richlist], ["/watchlist", t.watchlist], ["/status", t.status]]],
  ];
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-cols">
          <div className="footer-brand">
            <span className="logo" aria-hidden="true">π</span>
            <div>
              <strong dir="ltr">{t.siteName}</strong>
              <p>{t.tagline}</p>
            </div>
          </div>
          {cols.map(([title, links]) => (
            <div key={title}>
              <div className="footer-title">{title}</div>
              {links.map(([href, label]) =>
                href.startsWith("http") ? (
                  <a key={href} href={href} rel="noopener" target="_blank">{label}</a>
                ) : (
                  <Link key={href} href={href}>{label}</Link>
                ),
              )}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <p>{t.disclaimer}</p>
          <p dir="ltr">© {new Date().getUTCFullYear()} Blockchain Pi</p>
        </div>
      </div>
    </footer>
  );
}
