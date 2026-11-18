import type { Metadata } from "next";
import Link from "next/link";
import { AccountLink, Amount, Card, Facts, PageTitle } from "@/components/ui";
import { Ago } from "@/components/Ago";
import { compact, lockOwner, shortId, unlockTime } from "@/lib/format";
import { horizon, HorizonError, type Account, type ClaimableBalance, type Operation } from "@/lib/horizon";
import { pageMeta } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import type { Network } from "@/lib/horizon";

export const revalidate = 60;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Compare wallets", "/compare");
}

const ID = /^G[A-Z2-7]{55}$/;

interface Side {
  id: string;
  account: Account | null;
  balance: number;
  locked: number;
  nextUnlock: string | null;
  ops: Operation[];
}

async function load(net: Network, id: string): Promise<Side> {
  const [account, claim, ops] = await Promise.all([
    horizon.account(net, id).catch((e) => (e instanceof HorizonError && e.status === 404 ? null : Promise.reject(e))),
    horizon.accountClaimable(net, id).catch(() => ({ records: [] as ClaimableBalance[] })),
    horizon.accountOperations(net, id, { limit: 200, order: "desc" }).catch(() => ({ records: [] as Operation[] })),
  ]);
  let locked = 0;
  const times: string[] = [];
  for (const c of claim.records) {
    if (c.asset !== "native") continue;
    locked += Number(c.amount);
    const owner = lockOwner(c.claimants.filter((x) => x.destination === id));
    const at = owner ? unlockTime(owner.predicate) : null;
    if (at && Date.parse(at) > Date.now()) times.push(at);
  }
  const balance = Number(account?.balances.find((b) => b.asset_type === "native")?.balance ?? 0);
  return { id, account, balance, locked, nextUnlock: times.sort()[0] ?? null, ops: ops.records };
}

/** Pi payments (and account creation) from one wallet to the other, in the loaded history. */
function between(ops: Operation[], from: string, to: string) {
  let total = 0;
  const list: { at: string; amount: number; hash: string }[] = [];
  for (const o of ops) {
    if (!o.transaction_successful) continue;
    const isPay = o.type === "payment" && o.asset_type === "native" && o.from === from && o.to === to;
    const isCreate = o.type === "create_account" && o.funder === from && o.account === to;
    if (!isPay && !isCreate) continue;
    const amount = Number(isPay ? o.amount : o.starting_balance);
    total += amount;
    list.push({ at: o.created_at, amount, hash: o.transaction_hash });
  }
  return { total, list };
}

function VsBar({ a, b, fmt }: { a: number; b: number; fmt: (n: number) => string }) {
  const sum = a + b || 1;
  return (
    <div>
      <div className="vs-bar" role="img" aria-label={`${fmt(a)} / ${fmt(b)}`}>
        {a > 0 ? <span style={{ flex: a / sum, background: "var(--chart)" }} /> : null}
        {b > 0 ? <span style={{ flex: b / sum, background: "var(--chart-3)" }} /> : null}
      </div>
      <div className="vs-legend">
        <span>A · <b dir="ltr">{fmt(a)}</b></span>
        <span>B · <b dir="ltr">{fmt(b)}</b></span>
      </div>
    </div>
  );
}

export default async function Compare({ params }: { params: Promise<{ s: string }> }) {
  const { lang, net, native, q } = await getSettings(params);
  const ar = lang === "ar";
  const a = (q.a ?? "").trim().toUpperCase();
  const b = (q.b ?? "").trim().toUpperCase();
  const ready = ID.test(a) && ID.test(b) && a !== b;
  const L = ar
    ? { title: "مقارنة محفظتين", sub: "حط عنوانين وشوف الرصيد والقفل والنشاط والتحويلات اللي بينهم.", a: "المحفظة A", b: "المحفظة B", go: "قارن", bad: "اكتب عنوانين مختلفين صح (بيبدأوا بـ G و56 حرف).", balance: "الرصيد", locked: "المقفول", activity: "النشاط (آخر 200 عملية)", last: "آخر نشاط", next: "أقرب فك قفل", none: "مفيش", notFunded: "الحساب ده مش مفعّل", transfers: "التحويلات بينهم", aToB: "من A لـ B", bToA: "من B لـ A", noTransfers: "مفيش تحويلات بينهم في آخر 200 عملية لكل محفظة.", ops: "عملية", swap: "بدّل" }
    : { title: "Compare two wallets", sub: "Enter two addresses to compare balance, locked Pi, activity and the transfers between them.", a: "Wallet A", b: "Wallet B", go: "Compare", bad: "Enter two different valid addresses (G… and 56 characters).", balance: "Balance", locked: "Locked", activity: "Activity (last 200 operations)", last: "Last activity", next: "Next unlock", none: "None", notFunded: "This account is not funded", transfers: "Transfers between them", aToB: "A → B", bToA: "B → A", noTransfers: "No transfers between them in each wallet's last 200 operations.", ops: "ops", swap: "Swap" };

  const form = (
    <Card>
      <form className="compare-form" action="/compare" method="get">
        <label>
          {L.a}
          <input name="a" defaultValue={a} placeholder="G…" spellCheck={false} autoComplete="off" dir="ltr" required pattern="[Gg][A-Za-z2-7]{55}" />
        </label>
        <label>
          {L.b}
          <input name="b" defaultValue={b} placeholder="G…" spellCheck={false} autoComplete="off" dir="ltr" required pattern="[Gg][A-Za-z2-7]{55}" />
        </label>
        <button className="btn" type="submit">{L.go}</button>
      </form>
      {(a || b) && !ready ? <p className="notice" style={{ marginBottom: 0 }}>{L.bad}</p> : null}
    </Card>
  );

  if (!ready) {
    return (
      <>
        <PageTitle title={L.title} sub={L.sub} />
        {form}
      </>
    );
  }

  const [A, B] = await Promise.all([load(net, a), load(net, b)]);
  const ab = between([...A.ops, ...B.ops.filter((o) => !A.ops.some((x) => x.id === o.id))], a, b);
  const ba = between([...A.ops, ...B.ops.filter((o) => !A.ops.some((x) => x.id === o.id))], b, a);
  const fmt = (n: number) => `${compact(n, lang)} ${native}`;
  const recent = [...ab.list.map((x) => ({ ...x, dir: "ab" as const })), ...ba.list.map((x) => ({ ...x, dir: "ba" as const }))].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 10);

  return (
    <>
      <PageTitle title={L.title} sub={L.sub} />
      {form}
      <div className="compare-grid">
        {[A, B].map((s, i) => (
          <section className="card compare-col" key={s.id}>
            <h2>
              <span className="badge" style={{ background: i ? "var(--chart-3)" : "var(--chart)", color: "#fff" }}>{i ? "B" : "A"}</span>
              <AccountLink id={s.id} />
            </h2>
            {!s.account ? (
              <p className="notice">{L.notFunded}</p>
            ) : (
              <Facts
                rows={[
                  [L.balance, <Amount key="b" value={s.balance.toFixed(7)} asset={native} max={2} />],
                  [L.locked, <Amount key="l" value={s.locked.toFixed(7)} asset={native} max={2} />],
                  [L.last, s.ops[0] ? <Ago key="a" iso={s.ops[0].created_at} lang={lang} /> : L.none],
                  [L.next, s.nextUnlock ? new Date(s.nextUnlock).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : L.none],
                ]}
              />
            )}
          </section>
        ))}
      </div>

      <div className="grid-2">
        <Card title={L.balance}><VsBar a={A.balance} b={B.balance} fmt={fmt} /></Card>
        <Card title={L.locked}><VsBar a={A.locked} b={B.locked} fmt={fmt} /></Card>
      </div>
      <Card title={L.activity}><VsBar a={A.ops.length} b={B.ops.length} fmt={(n) => `${n} ${L.ops}`} /></Card>

      <Card title={L.transfers} action={<Link className="btn-ghost small" href={`/compare?a=${b}&b=${a}`}>{L.swap}</Link>}>
        {recent.length ? (
          <>
            <VsBar a={ab.total} b={ba.total} fmt={fmt} />
            <p className="muted chart-note">A = {L.aToB} · B = {L.bToA}</p>
            <ul className="rows">
              {recent.map((r) => (
                <li key={r.hash + r.dir + r.at}>
                  <div className="main-col">
                    <Link href={`/tx/${r.hash}`} className="mono" dir="ltr">{shortId(r.hash, 6, 6)}</Link>
                    <span className="meta">{r.dir === "ab" ? L.aToB : L.bToA} · <Ago iso={r.at} lang={lang} /></span>
                  </div>
                  <div className="side-col"><Amount value={r.amount.toFixed(7)} asset={native} max={2} /></div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">{L.noTransfers}</p>
        )}
      </Card>
    </>
  );
}
