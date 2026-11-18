import { Donut } from "@/components/Donut";
import { compact, formatAmount } from "@/lib/format";
import type { ExtraDict } from "@/lib/i18n-extra";
import type { MainnetSupply } from "@/lib/supply";

/** Pi mainnet supply at a glance: a donut of the effective total plus every official figure. */
export function SupplyCard({ s, x, lang }: { s: MainnetSupply; x: ExtraDict["mainnet"]; lang: "ar" | "en" }) {
  const rest = Math.max(0, s.effectiveTotal - s.migrated);
  const pi = (v: number) => `${compact(v, lang)} π`;
  const rows: [string, number, string?][] = [
    [x.migrated, s.migrated, `${((s.migrated / s.max) * 100).toFixed(1)}% ${x.ofMax}`],
    [x.locked, s.locked, `${((s.locked / s.migrated) * 100).toFixed(1)}% ${x.lockedShare}`],
    [x.unlocked, s.unlocked],
    [x.circulating, s.circulating],
    [x.effective, s.effectiveTotal],
    [x.max, s.max],
  ];
  return (
    <section className="card supply-card" aria-label={x.title}>
      <header className="card-head">
        <h2>{x.title}</h2>
        <span className="muted" style={{ fontSize: 12 }}>{x.source}</span>
      </header>
      <div className="supply-grid">
        <Donut
          ariaLabel={x.title}
          center={compact(s.effectiveTotal, lang)}
          sub={x.effective.split(" (")[0]}
          slices={[
            { key: "u", label: x.unlocked, value: s.unlocked, display: pi(s.unlocked), tone: 1 },
            { key: "l", label: x.locked, value: s.locked, display: pi(s.locked), tone: 2 },
            { key: "r", label: x.notMigrated, value: rest, display: pi(rest), tone: 0 },
          ]}
        />
        <dl className="supply-rows">
          {rows.map(([k, v, hint]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                <bdi dir="ltr">{formatAmount(v.toFixed(3), 3)} π</bdi>
                {hint ? <small>{hint}</small> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="supply-meter" title={`${x.migrated}: ${((s.migrated / s.max) * 100).toFixed(2)}% ${x.ofMax}`}>
        <span className="tone-1" style={{ width: `${(s.unlocked / s.max) * 100}%` }} />
        <span className="tone-2" style={{ width: `${(s.locked / s.max) * 100}%` }} />
        <span className="tone-0" style={{ width: `${(rest / s.max) * 100}%` }} />
      </div>
      <div className="supply-meter-legend muted">
        <span>{x.max}: <bdi dir="ltr">100B π</bdi></span>
        <span><bdi dir="ltr">{((s.migrated / s.max) * 100).toFixed(1)}%</bdi> {x.ofMax}</span>
      </div>
    </section>
  );
}
