import { describe, expect, it } from "vitest";
import { classifySearch, formatAmount, shortId, stroopsToPi, unlockTime, expiryTime } from "@/lib/format";
import { summarize } from "@/lib/operations";
import type { Operation } from "@/lib/horizon";

describe("formatAmount", () => {
  it("groups thousands and trims trailing zeros without float errors", () => {
    expect(formatAmount("100000000000.0000000")).toBe("100,000,000,000");
    expect(formatAmount("1387.1481238")).toBe("1,387.1481238");
    expect(formatAmount("0.0003140")).toBe("0.000314");
    expect(formatAmount("12935688.7675249", 2)).toBe("12,935,688.76");
    expect(formatAmount(undefined)).toBe("—");
  });
});

describe("stroopsToPi", () => {
  it("converts stroops exactly", () => {
    expect(stroopsToPi(100000)).toBe("0.01");
    expect(stroopsToPi("4900000")).toBe("0.49");
    expect(stroopsToPi("12345678901")).toBe("1,234.5678901");
  });
});

describe("shortId", () => {
  it("keeps short values and shortens long ones", () => {
    expect(shortId("abc")).toBe("abc");
    expect(shortId("GBUWYT5RMK4OR6ETZECY2VQ4U3AZCAXOJZFOUFDPBZYGDXUQK46NW7PY", 5, 5)).toBe("GBUWY…NW7PY");
  });
});

describe("classifySearch", () => {
  it("recognises every kind of identifier", () => {
    expect(classifySearch("29797980")).toEqual({ kind: "ledger", value: "29797980" });
    expect(classifySearch(" B54DF085A99A9527E3A60168EEF418222EBE947C7344D75BC7A8DF2224BBD92F ")).toEqual({
      kind: "tx",
      value: "b54df085a99a9527e3a60168eef418222ebe947c7344d75bc7a8df2224bbd92f",
    });
    expect(classifySearch("gbuwyt5rmk4or6etzecy2vq4u3azcaxojzfoufdpbzygdxuqk46nw7py").kind).toBe("account");
    expect(classifySearch("000000004640e5f2059ef8e97da5bf476aeeda5ae6a515d0319422c8bb1b0867eb430abc").kind).toBe("claimable");
    expect(classifySearch("usdt")).toEqual({ kind: "asset", value: "USDT" });
    expect(classifySearch("hello world!").kind).toBe("unknown");
  });
});

describe("lockup predicates", () => {
  it("reads the unlock date of a Pi lockup", () => {
    expect(unlockTime({ not: { abs_before: "2027-11-17T19:53:21Z" } })).toBe("2027-11-17T19:53:21Z");
    expect(unlockTime({ unconditional: true })).toBeNull();
    expect(
      unlockTime({ and: [{ not: { abs_before: "2027-01-01T00:00:00Z" } }, { abs_before: "2030-01-01T00:00:00Z" }] }),
    ).toBe("2027-01-01T00:00:00Z");
    expect(expiryTime({ and: [{ not: { abs_before: "2027-01-01T00:00:00Z" } }, { abs_before: "2030-01-01T00:00:00Z" }] })).toBe(
      "2030-01-01T00:00:00Z",
    );
  });
});

describe("summarize", () => {
  const base = { id: "1", paging_token: "1", transaction_successful: true, source_account: "GA", created_at: "", transaction_hash: "h" };
  it("describes a native payment", () => {
    const op = { ...base, type: "payment", from: "GFROM", to: "GTO", amount: "1.5", asset_type: "native" } as Operation;
    expect(summarize(op, "en")).toEqual([
      { k: "account", v: "GFROM" },
      { k: "text", v: "to" },
      { k: "account", v: "GTO" },
      { k: "amount", v: "1.5", asset: "Pi" },
    ]);
  });
  it("shows the unlock date of a lockup", () => {
    const op = {
      ...base,
      type: "create_claimable_balance",
      asset: "native",
      amount: "10",
      claimants: [{ destination: "GOWNER", predicate: { not: { abs_before: "2027-11-17T19:53:21Z" } } }],
    } as Operation;
    const parts = summarize(op, "ar");
    expect(parts[0]).toEqual({ k: "amount", v: "10", asset: "Pi" });
    expect(parts.at(-1)).toEqual({ k: "text", v: "· يتفك 2027-11-17" });
  });
});
