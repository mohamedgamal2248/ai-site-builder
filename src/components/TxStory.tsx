import { WalletBadge } from "@/components/WalletBadge";
import { HoverLink as Link } from "@/components/HoverLink";
import { knownWallet } from "@/data/wallets";
import { toActivity } from "@/lib/activity";
import { formatAmount, lockOwner, shortId, unlockTime } from "@/lib/format";
import type { Operation, Predicate } from "@/lib/horizon";

type Lang = "ar" | "en";

function Party({ id, lang, fresh }: { id?: string; lang: Lang; fresh?: boolean }) {
  if (!id) return <span className="story-party muted">—</span>;
  const k = knownWallet(id);
  return (
    <Link href={`/account/${id}`} className={`story-party${k ? ` cat-${k.category}` : ""}`}>
      {k ? <WalletBadge logo={k.logo} size={26} /> : <span className="story-avatar" aria-hidden="true">{fresh ? "✦" : id.slice(1, 3)}</span>}
      <span className="story-name">{k ? (lang === "ar" ? k.labelAr : k.label).split(" · ")[0] : <bdi className="mono" dir="ltr">{shortId(id, 4, 4)}</bdi>}</span>
      {fresh ? <span className="story-tag">{lang === "ar" ? "حساب جديد" : "new account"}</span> : null}
    </Link>
  );
}

const name = (id: string | undefined, lang: Lang) => {
  if (!id) return "—";
  const k = knownWallet(id);
  return k ? (lang === "ar" ? k.labelAr : k.label).split(" · ")[0] : shortId(id, 4, 4);
};

/**
 * The transaction told as a story: who sent what to whom, as a small flow diagram with the
 * known-wallet badges, plus one plain sentence per movement. Only the money-moving operations
 * are drawn (up to 6); the full list stays in the table below.
 */
export function TxStory({ ops, ok, lang, native }: { ops: Operation[]; ok: boolean; lang: Lang; native: string }) {
  const rows = ops
    .map((op) => ({ op, a: toActivity(op, native) }))
    .filter(({ a }) => a.kind !== "other")
    .slice(0, 6);
  if (!rows.length) return null;
  const fmtDate = (iso: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(iso));

  return (
    <section className="card story" aria-label={lang === "ar" ? "ملخص المعاملة" : "Transaction summary"}>
      {!ok ? <p className="story-failed">{lang === "ar" ? "⚠️ المعاملة دي فشلت، فمحصلش أي تحويل فعلي." : "⚠️ This transaction failed, so nothing actually moved."}</p> : null}
      {rows.map(({ op, a }) => {
        const amount = a.amount ? `${formatAmount(a.amount, 4)} ${a.asset ?? native}` : "";
        let unlock: string | null = null;
        if (a.kind === "lock" && Array.isArray(op.claimants)) {
          const owner = lockOwner(op.claimants as { destination: string; predicate: Predicate }[]);
          unlock = owner ? unlockTime(owner.predicate) : null;
        }
        const from = knownWallet(a.from);
        const to = knownWallet(a.to);
        const tag =
          to?.category === "exchange" ? (lang === "ar" ? "إيداع في منصة" : "Exchange deposit")
          : from?.category === "exchange" ? (lang === "ar" ? "سحب من منصة" : "Exchange withdrawal")
          : from?.category === "foundation" ? (lang === "ar" ? "من الفاونديشن" : "From the Foundation")
          : null;
        const A = name(a.from, lang);
        const B = name(a.to, lang);
        const sentence =
          lang === "ar"
            ? a.kind === "payment" ? `${A} حوّل ${amount} لـ ${B}.`
            : a.kind === "create" ? `${A} فتح حساب جديد ${B} وحطّ فيه ${amount}.`
            : a.kind === "lock" ? `${A} قفل ${amount} لصالح ${B}${unlock ? `، وهيتفك يوم ${fmtDate(unlock)}` : ""}.`
            : `${A} استلم رصيد كان مقفول.`
            : a.kind === "payment" ? `${A} sent ${amount} to ${B}.`
            : a.kind === "create" ? `${A} opened a new account ${B} with ${amount}.`
            : a.kind === "lock" ? `${A} locked ${amount} for ${B}${unlock ? `, unlocking on ${fmtDate(unlock)}` : ""}.`
            : `${A} claimed a locked balance.`;
        return (
          <div key={op.id} className={`story-row k-${a.kind}`}>
            <div className="story-flow">
              <Party id={a.from} lang={lang} />
              <div className="story-arrow">
                <span className="story-amount">{a.kind === "claim" ? (lang === "ar" ? "استلام" : "claim") : <bdi dir="ltr">{amount}</bdi>}</span>
                <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path d="M0 6h94" /><path d="m88 1 8 5-8 5" /></svg>
                {a.kind === "lock" ? <span className="story-lock">🔒 {unlock ? fmtDate(unlock) : ""}</span> : null}
              </div>
              {a.kind === "claim" ? <span className="story-party muted">🔓</span> : <Party id={a.to} lang={lang} fresh={a.kind === "create"} />}
            </div>
            <p className="story-text">
              {tag ? <span className={`story-chip ${to?.category === "exchange" ? "warn" : ""}`}>{tag}</span> : null}
              {sentence}
            </p>
          </div>
        );
      })}
    </section>
  );
}
