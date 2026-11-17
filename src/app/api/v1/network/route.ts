import type { NextRequest } from "next/server";
import { apiError, apiJson, apiNet, apiOptions } from "@/lib/api";
import { horizon } from "@/lib/horizon";
import { getMarket, getPiPrice } from "@/lib/price";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET(req: NextRequest) {
  const net = apiNet(req);
  try {
    const [ledger, fees, price, market] = await Promise.all([
      horizon.ledgers(net, { limit: 1 }).then((p) => p.records[0]),
      horizon.feeStats(net).catch(() => null),
      net === "mainnet" ? getPiPrice() : null,
      net === "mainnet" ? getMarket() : null,
    ]);
    return apiJson(
      {
        network: net,
        latest_ledger: ledger.sequence,
        closed_at: ledger.closed_at,
        protocol_version: ledger.protocol_version,
        total_coins: ledger.total_coins,
        fee_pool: ledger.fee_pool,
        base_fee_stroops: ledger.base_fee_in_stroops,
        base_reserve_stroops: ledger.base_reserve_in_stroops,
        ledger_capacity_usage: fees ? Number(fees.ledger_capacity_usage) : null,
        price_usd: price?.last ?? null,
        change_24h_pct: price ? Number(price.changePct.toFixed(3)) : null,
        market_cap_usd: market?.marketCap ?? null,
        circulating_supply: market?.circulating ?? null,
      },
      10,
    );
  } catch (e) {
    return apiError(e);
  }
}
