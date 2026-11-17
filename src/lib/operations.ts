import type { Operation } from "./horizon";
import { assetLabel, canonicalAssetLabel, unlockTime } from "./format";
import type { Lang } from "./i18n";

/** A sentence made of plain text, account links and amounts, rendered by <OpSummary>. */
export type Part =
  | { k: "text"; v: string }
  | { k: "account"; v: string }
  | { k: "amount"; v: string; asset: string }
  | { k: "pool"; v: string };

const T = {
  en: { to: "to", from: "from", for: "for", at: "at", sends: "sent", start: "starting balance", unlock: "unlocks", claim: "claimed", merge: "merged into", sell: "sell", buy: "buy", trust: "trust", limit: "limit", remove: "removed", name: "key", by: "by", sponsor: "sponsoring" },
  ar: { to: "إلى", from: "من", for: "مقابل", at: "بسعر", sends: "أرسل", start: "رصيد بداية", unlock: "يتفك", claim: "استلم", merge: "اندمج في", sell: "بيع", buy: "شراء", trust: "ثقة في", limit: "حد", remove: "حذف", name: "مفتاح", by: "بواسطة", sponsor: "يرعى" },
};

const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));

function asset(op: Operation, prefix = "", native = "Pi") {
  return assetLabel(str(op[`${prefix}asset_type`]) || undefined, str(op[`${prefix}asset_code`]) || undefined, native);
}

export function summarize(op: Operation, lang: Lang, native = "Pi"): Part[] {
  const w = T[lang];
  const text = (v: string): Part => ({ k: "text", v });
  const acc = (v: unknown): Part => ({ k: "account", v: str(v) });
  const amt = (v: unknown, a: string): Part => ({ k: "amount", v: str(v), asset: a });

  switch (op.type) {
    case "create_account":
      return [acc(op.funder), text(w.to), acc(op.account), text(`· ${w.start}`), amt(op.starting_balance, native)];
    case "payment":
      return [acc(op.from), text(w.to), acc(op.to), amt(op.amount, asset(op, "", native))];
    case "path_payment_strict_receive":
    case "path_payment_strict_send":
      return [
        acc(op.from), text(w.sends), amt(op.source_amount, asset(op, "source_", native)),
        text(w.to), acc(op.to), amt(op.amount, asset(op, "", native)),
      ];
    case "manage_sell_offer":
    case "create_passive_sell_offer":
      return [text(w.sell), amt(op.amount, asset(op, "selling_", native)), text(w.for), text(asset(op, "buying_", native)), text(`${w.at} ${str(op.price)}`)];
    case "manage_buy_offer":
      return [text(w.buy), amt(op.amount, asset(op, "buying_", native)), text(w.for), text(asset(op, "selling_", native)), text(`${w.at} ${str(op.price)}`)];
    case "change_trust":
      return [text(w.trust), text(str(op.asset_code) || "LP"), ...(op.asset_issuer ? [acc(op.asset_issuer)] : []), text(`${w.limit} ${str(op.limit)}`)];
    case "account_merge":
      return [acc(op.account), text(w.merge), acc(op.into)];
    case "manage_data":
      return [text(`${w.name}: ${str(op.name)}`), ...(op.value ? [] : [text(`(${w.remove})`)])];
    case "create_claimable_balance": {
      const claimants = Array.isArray(op.claimants) ? (op.claimants as { destination: string; predicate: never }[]) : [];
      const first = claimants[0];
      const when = first ? unlockTime(first.predicate) : null;
      return [
        amt(op.amount, canonicalAssetLabel(str(op.asset), native)),
        ...(first ? [text(w.for), acc(first.destination)] : []),
        ...(when ? [text(`· ${w.unlock} ${when.slice(0, 10)}`)] : []),
      ];
    }
    case "claim_claimable_balance":
      return [acc(op.claimant), text(w.claim)];
    case "begin_sponsoring_future_reserves":
      return [acc(op.source_account), text(w.sponsor), acc(op.sponsored_id)];
    case "liquidity_pool_deposit":
    case "liquidity_pool_withdraw":
      return [{ k: "pool", v: str(op.liquidity_pool_id) }];
    case "set_options":
      return [acc(op.source_account), ...(op.home_domain ? [text(`· ${str(op.home_domain)}`)] : [])];
    case "bump_sequence":
      return [text(str(op.bump_to))];
    default:
      return [acc(op.source_account)];
  }
}
