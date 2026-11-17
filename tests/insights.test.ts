import { describe, expect, it } from "vitest";
import { parseRss } from "@/lib/insights";
import { backtestFlows, bandOf, combine, summarize, WEIGHTS, type Component } from "@/lib/pindex";

const c = (key: Component["key"], signal: number | null): Component => ({ key, value: 0, baseline: 0, z: signal, signal, weight: WEIGHTS[key], available: signal !== null });

describe("pressure index", () => {
  it("is 50 when every signal is normal and moves with the weighted signals", () => {
    expect(combine([c("exchange_net", 0), c("order_book", 0), c("whales", 0)])).toBe(50);
    // Heavy exchange inflow (z=+3, signed -3) and nothing else: strongly bearish.
    expect(combine([c("exchange_net", -3), c("order_book", 0), c("whales", 0)])).toBeLessThan(30);
    expect(combine([c("exchange_net", 3), c("order_book", 3), c("whales", 3), c("foundation_out", 3), c("unlocks", 3), c("large_deposits", 3)])).toBe(100);
  });
  it("needs at least 30% of the weight to produce a score", () => {
    expect(combine([c("large_deposits", 2), c("exchange_net", null)])).toBeNull();
  });
  it("names the bands", () => {
    expect([bandOf(10), bandOf(40), bandOf(50), bandOf(60), bandOf(90), bandOf(null)]).toEqual(["strong_sell", "sell", "neutral", "buy", "strong_buy", null]);
  });
});

describe("backtest", () => {
  it("calls sell on unusual inflow and scores it against the next day's move", () => {
    const daily = Array.from({ length: 12 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, net: i === 10 ? 1_000_000 : (i % 2 ? 1000 : -1000) }));
    const closes = daily.map((d, i) => ({ day: d.day, close: i === 11 ? 0.9 : 1 }));
    const rows = backtestFlows(daily, closes);
    const spike = rows.find((r) => r.day === "2026-10-11")!;
    expect(spike.call).toBe("sell");
    expect(spike.hit).toBe(true);
    expect(summarize(rows).hits).toBeGreaterThanOrEqual(1);
  });
});

describe("rss", () => {
  it("parses Google News style items and strips the source suffix", () => {
    const xml = `<rss><channel><item><title><![CDATA[Pi Network rises 5% - CoinDesk]]></title><link>https://example.com/a</link><pubDate>Mon, 17 Nov 2026 10:00:00 GMT</pubDate><source url="https://coindesk.com">CoinDesk</source></item></channel></rss>`;
    expect(parseRss(xml)).toEqual([{ title: "Pi Network rises 5%", link: "https://example.com/a", source: "CoinDesk", at: "2026-11-17T10:00:00.000Z" }]);
  });
});
