import Link from "next/link";
import type { Settings } from "@/lib/settings";
import { insightDicts } from "@/lib/i18n-insights";
import { Logo } from "./Logo";
import { NavMenu } from "./NavMenu";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";

/** Every page, grouped as in the menu (also feeds the Ctrl K search). */
export function navGroups(s: Settings) {
  const { t, lang } = s;
  const x = insightDicts[lang];
  const insights: [string, string][] = [["/pressure", x.index], ["/pressure/accuracy", x.accuracy], ["/alerts", x.alerts], ["/radar", x.radar], ["/whale-tracker", x.whaleTracker], ["/depth", x.depth], ["/report", x.report], ["/report/week", lang === "ar" ? "التقرير الأسبوعي" : "Weekly report"], ["/growth", lang === "ar" ? "نمو الشبكة" : "Network growth"], ["/news", x.news]];
  return [
    { label: x.group, items: insights },
    { label: t.groupChain, items: [["/blocks", t.blocks], ["/txs", t.transactions], ["/operations", t.operations]] as [string, string][] },
    { label: t.groupStats, items: [["/stats", t.stats], ["/flows", t.flows], ["/whales", t.whales], ["/supply", t.supply], ["/unlocks", t.unlocks], ["/largest", t.largest], ["/locked", t.locked]] as [string, string][] },
    { label: t.groupTokens, items: [["/assets", t.assets], ["/pools", t.pools], ["/trades", t.trades]] as [string, string][] },
    { label: t.groupTools, items: [["/wallets", t.wallets], ["/richlist", t.richlist], ["/watchlist", t.watchlist], ["/learn", lang === "ar" ? "تعلّم" : "Learn"], ["/widgets", lang === "ar" ? "ودجت لموقعك" : "Widget"], ["/api-docs", t.apiDocs], ["/status", t.status]] as [string, string][] },
  ];
}

export function Header({ s }: { s: Settings }) {
  const { t, lang, net } = s;
  const x = insightDicts[lang];
  const groups = navGroups(s);
  const quick: [string, string][] = [["/", t.home], ["/pressure", x.index], ["/whales", t.whales], ["/flows", t.flows], ["/txs", t.transactions], ["/unlocks", t.unlocks]];
  return (
    <>
      <header className="site-header">
        <div className="container header-top">
          <Link href="/" className="brand" aria-label={t.siteName}>
            <Logo />
            <span className="brand-text">
              <strong dir="ltr">{t.siteName}</strong>
              <small>{t.tagline}</small>
            </span>
          </Link>
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
          <div className="toggles">
            <ThemeToggle labels={{ theme: t.theme, auto: t.themeAuto, light: t.themeLight, dark: t.themeDark }} />
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
      </header>
      <nav className="main-nav" aria-label="Main">
        <NavMenu home={t.home} groups={groups} quick={quick} labels={{ menu: t.menu, close: t.close }} />
      </nav>
    </>
  );
}

export function Footer({ s }: { s: Settings }) {
  const { t, lang } = s;
  const x = insightDicts[lang];
  const cols: [string, [string, string][]][] = [
    [x.group, [["/pressure", x.index], ["/alerts", x.alerts], ["/radar", x.radar], ["/report", x.report], ["/learn", lang === "ar" ? "تعلّم" : "Learn"]]],
    [t.footerExplore, [["/blocks", t.blocks], ["/txs", t.transactions], ["/operations", t.operations], ["/assets", t.assets]]],
    [t.footerStats, [["/stats", t.stats], ["/flows", t.flows], ["/whales", t.whales], ["/supply", t.supply], ["/unlocks", t.unlocks]]],
    [t.footerDevelopers, [["/api-docs", t.apiDocs], ["https://github.com/mohamedgamal2248/blockchain-pi", t.sourceCode], ["https://api.mainnet.minepi.com", t.dataSource]]],
    [t.groupTools, [["/wallets", t.wallets], ["/richlist", t.richlist], ["/watchlist", t.watchlist], ["/status", t.status]]],
  ];
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-cols">
          <div className="footer-brand">
            <Logo />
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
