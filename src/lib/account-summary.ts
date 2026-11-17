import { horizon, HorizonError, type Network } from "./horizon";

export interface AccountSummary {
  id: string;
  exists: boolean;
  balance: string | null;
  locked: string;
  lockups: number;
  last_activity: string | null;
  last_operation: string | null;
}

/** Balance, locked Pi and the time of the latest operation, for the watchlist and the public API. */
export async function getAccountSummary(net: Network, id: string): Promise<AccountSummary> {
  const [account, locks, ops] = await Promise.all([
    horizon.account(net, id).catch((e) => {
      if (e instanceof HorizonError && e.status === 404) return null;
      throw e;
    }),
    horizon.accountClaimable(net, id).catch(() => ({ records: [] })),
    horizon.accountOperations(net, id, { limit: 1 }).catch(() => ({ records: [] })),
  ]);
  const native = locks.records.filter((c) => c.asset === "native");
  const last = ops.records[0];
  return {
    id,
    exists: !!account,
    balance: account?.balances.find((b) => b.asset_type === "native")?.balance ?? null,
    locked: native.reduce((sum, c) => sum + Number(c.amount), 0).toFixed(7),
    lockups: native.length,
    last_activity: last?.created_at ?? null,
    last_operation: last?.type ?? null,
  };
}
