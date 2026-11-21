import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lockOwner } from "@/lib/format";
import { applyPage, shouldSkip } from "@/lib/ingest";
import { backfillProgress } from "@/lib/stats";

describe("lockOwner", () => {
  it("picks the claimant who can claim only after a date", () => {
    const claimants = [
      { destination: "GSENDER", predicate: { abs_before: "2022-07-09T07:20:53Z" } },
      { destination: "GOWNER", predicate: { not: { abs_before: "2023-01-07T22:42:22Z" } } },
    ];
    expect(lockOwner(claimants)?.destination).toBe("GOWNER");
  });
});

describe("backfillProgress", () => {
  it("reads the ledger from a claimable-balance cursor", () => {
    expect(backfillProgress("14899000-000abc", 29798000)).toBeCloseTo(50, 0);
    expect(backfillProgress(undefined, 100)).toBe(0);
  });
});

// Needs a throwaway Postgres: TEST_DATABASE_URL=postgres://postgres@localhost:54329/pi_test
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("applyPage (Postgres)", () => {
  const sql = postgres(url ?? "postgres://invalid", { max: 1, onnotice: () => {} });
  const net = "testnet" as const;

  beforeAll(async () => {
    await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
    await sql`delete from daily_stats where net = ${net}`;
    await sql`delete from large_payments where net = ${net}`;
    await sql`delete from sync_state where net = ${net}`;
    await sql`delete from wallet_flows_daily where net = ${net}`;
    await sql`delete from holders where net = ${net}`;
  });
  afterAll(async () => {
    await sql.end();
  });

  it("aggregates ledgers per day and stores the cursor in the same transaction", async () => {
    await applyPage(sql, net, "ledgers", [
      { paging_token: "1", closed_at: "2026-11-17T10:00:00Z", successful_transaction_count: 3, failed_transaction_count: 1, operation_count: 5 },
      { paging_token: "2", closed_at: "2026-11-17T10:00:05Z", successful_transaction_count: 2, failed_transaction_count: 0, operation_count: 2 },
    ]);
    await applyPage(sql, net, "ledgers", [
      { paging_token: "3", closed_at: "2026-11-17T10:00:10Z", successful_transaction_count: 1, failed_transaction_count: 0, operation_count: 1 },
    ]);
    const [d] = await sql`select ledgers, txs, failed_txs, ops from daily_stats where net = ${net} and day = '2026-11-17'`;
    expect(d).toEqual({ ledgers: 3, txs: 6, failed_txs: 1, ops: 8 });
    const [c] = await sql`select cursor from sync_state where net = ${net} and stream = 'ledgers'`;
    expect(c.cursor).toBe("3");
  });

  it("counts payments, keeps large ones and counts claims", async () => {
    await applyPage(
      sql, net, "operations",
      [
        { id: "op1", paging_token: "op1", type: "payment", asset_type: "native", amount: "50000.0000000", from: "GALYJFJ5SVD45FBWN2GT4IW67SEZ3IBOFSBSPUFCWV427NBNLG3PXEQU", to: "GASWBDATCXXIUGHR7DWSFAAONZB2L5NFMBTDCYQQ2TQLRQNCTKJ2AODM", created_at: "2026-11-17T11:00:00Z", transaction_hash: "h1", transaction_successful: true, source_account: "GA" },
        { id: "op2", paging_token: "op2", type: "payment", asset_type: "native", amount: "1.5000000", from: "GA", to: "GB", created_at: "2026-11-17T11:00:01Z", transaction_hash: "h2", transaction_successful: true, source_account: "GA" },
        { id: "op3", paging_token: "op3", type: "create_account", starting_balance: "2.0000000", funder: "GA", account: "GC", created_at: "2026-11-17T11:00:02Z", transaction_hash: "h3", transaction_successful: true, source_account: "GA" },
        { id: "op4", paging_token: "op4", type: "claim_claimable_balance", balance_id: "bal1", claimant: "GOWNER", created_at: "2026-11-17T11:00:03Z", transaction_hash: "h4", transaction_successful: true, source_account: "GOWNER" },
      ],
      10000,
    );
    const [d] = await sql`select payments, payment_volume::text as v, new_accounts, claims from daily_stats where net = ${net} and day = '2026-11-17'`;
    expect(d).toEqual({ payments: 2, v: "50003.5000000", new_accounts: 1, claims: 1 });
    const large = await sql`select op_id, amount::text from large_payments where net = ${net}`;
    expect(large).toEqual([{ op_id: "op1", amount: "50000.0000000" }]);
    const holders = await sql`select account from holders where net = ${net} order by account`;
    expect(holders.map((h) => h.account)).toEqual(["GALYJFJ5SVD45FBWN2GT4IW67SEZ3IBOFSBSPUFCWV427NBNLG3PXEQU", "GASWBDATCXXIUGHR7DWSFAAONZB2L5NFMBTDCYQQ2TQLRQNCTKJ2AODM"]);
    const flows = await sql`select address, inflow::text, outflow::text from wallet_flows_daily where net = ${net} order by address`;
    expect(flows).toEqual([
      { address: "GALYJFJ5SVD45FBWN2GT4IW67SEZ3IBOFSBSPUFCWV427NBNLG3PXEQU", inflow: "0.0000000", outflow: "50000.0000000" },
      { address: "GASWBDATCXXIUGHR7DWSFAAONZB2L5NFMBTDCYQQ2TQLRQNCTKJ2AODM", inflow: "50000.0000000", outflow: "0.0000000" },
    ]);
  });

  it("skips a scheduled run only when caught up and the last run was recent", async () => {
    await sql`insert into sync_state (net, stream, cursor) values (${net}, 'backlog', '1'), (${net}, 'last_run', 'x')
              on conflict (net, stream) do update set cursor = excluded.cursor, updated_at = now()`;
    expect(await shouldSkip(sql, net)).toBe(false);
    await sql`update sync_state set cursor = '0' where net = ${net} and stream = 'backlog'`;
    expect(await shouldSkip(sql, net)).toBe(true);
    await sql`update sync_state set updated_at = now() - interval '10 minutes' where net = ${net} and stream = 'last_run'`;
    expect(await shouldSkip(sql, net)).toBe(false);
  });
});
