import { buildLatest, type Latest } from "./activity";
import { horizon, type Network } from "./horizon";

export * from "./activity";

/** Snapshot for the home page: 50 ledgers (sparklines) and 40 operations. */
export async function getLatest(net: Network, native = net === "testnet" ? "Test-Pi" : "Pi", fresh = false): Promise<Latest> {
  const [ledgers, ops] = await Promise.all([
    fresh ? horizon.ledgersFresh(net, 51) : horizon.ledgers(net, { limit: 51 }),
    fresh ? horizon.operationsFresh(net, 40) : horizon.operations(net, { limit: 40 }),
  ]);
  return buildLatest(net, ledgers.records, ops.records, native);
}
