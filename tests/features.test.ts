import { describe, expect, it } from "vitest";
import type { Operation } from "@/lib/horizon";
import { toActivity } from "@/lib/latest";
import { bucketDaily, type DailyRow } from "@/lib/stats";

const op = (o: Partial<Operation> & Record<string, unknown>) =>
  ({ id: "1", paging_token: "1", transaction_successful: true, source_account: "GSRC", created_at: "2026-11-17T10:00:00Z", transaction_hash: "h", type: "payment", ...o }) as Operation;

describe("toActivity", () => {
  it("classifies payments, lockups, claims and new accounts", () => {
    expect(toActivity(op({ type: "payment", from: "GA", to: "GB", amount: "2.5", asset_type: "native" }))).toMatchObject({ kind: "payment", from: "GA", to: "GB", amount: "2.5", asset: "Pi" });
    expect(
      toActivity(op({
        type: "create_claimable_balance", asset: "native", amount: "10",
        claimants: [{ destination: "GSENDER", predicate: { abs_before: "2026-12-01T00:00:00Z" } }, { destination: "GOWNER", predicate: { not: { abs_before: "2027-01-01T00:00:00Z" } } }],
      })),
    ).toMatchObject({ kind: "lock", to: "GOWNER", amount: "10", asset: "Pi" });
    expect(toActivity(op({ type: "claim_claimable_balance", claimant: "GC" }))).toMatchObject({ kind: "claim", from: "GC" });
    expect(toActivity(op({ type: "create_account", funder: "GF", account: "GN", starting_balance: "1" }))).toMatchObject({ kind: "create", from: "GF", to: "GN" });
    expect(toActivity(op({ type: "set_options" })).kind).toBe("other");
  });
});

describe("bucketDaily", () => {
  const row = (day: string, txs: number, vol: string): DailyRow => ({
    day, ledgers: 1, txs, failed_txs: 0, ops: txs, payments: 1, payment_volume: vol, new_accounts: 0, locks_created: 0, locked_amount: "0", claims: 0,
  });
  it("groups by ISO week (Monday) and by month", () => {
    const rows = [row("2026-11-16", 1, "1.5"), row("2026-11-17", 2, "2"), row("2026-11-23", 4, "1")];
    const weeks = bucketDaily(rows, "week");
    expect(weeks.map((w) => [w.day, w.txs, w.payment_volume])).toEqual([["2026-11-16", 3, "3.5000000"], ["2026-11-23", 4, "1"]]);
    expect(bucketDaily(rows, "month").map((m) => [m.day, m.txs])).toEqual([["2026-11", 7]]);
  });
});
