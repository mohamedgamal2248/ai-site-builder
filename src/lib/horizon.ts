/**
 * Thin client for Pi Network's public Horizon API (a Stellar Horizon fork).
 * Server-side only: responses go through Next's data cache, so every visitor
 * shares the same few upstream requests.
 */

export type Network = "mainnet" | "testnet";

const HOSTS: Record<Network, string> = {
  mainnet: process.env.PI_MAINNET_HORIZON || "https://api.mainnet.minepi.com",
  testnet: process.env.PI_TESTNET_HORIZON || "https://api.testnet.minepi.com",
};

export function horizonHost(net: Network) {
  return HOSTS[net];
}

/** How long a response may be reused. Ledgers and transactions never change once closed. */
export const CACHE = {
  live: 4,
  short: 15,
  medium: 60,
  immutable: 60 * 60 * 24 * 30,
} as const;

export class HorizonError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Page<T> {
  records: T[];
  next?: string;
  prev?: string;
}

async function get<T>(net: Network, path: string, revalidate: number): Promise<T> {
  const url = `${HOSTS[net]}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    ...(revalidate === 0 ? { cache: "no-store" as const } : { next: { revalidate } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { title?: string; detail?: string };
      detail = body.detail || body.title || detail;
    } catch {
      /* not JSON */
    }
    throw new HorizonError(res.status, detail);
  }
  return (await res.json()) as T;
}

interface RawPage<T> {
  _embedded: { records: T[] };
  _links: { next?: { href: string }; prev?: { href: string } };
}

function cursorOf(href?: string) {
  if (!href) return undefined;
  try {
    return new URL(href).searchParams.get("cursor") ?? undefined;
  } catch {
    return undefined;
  }
}

export interface ListQuery {
  cursor?: string;
  order?: "asc" | "desc";
  limit?: number;
  [key: string]: string | number | undefined;
}

function qs(q: ListQuery) {
  const p = new URLSearchParams();
  p.set("order", q.order ?? "desc");
  p.set("limit", String(Math.min(Math.max(q.limit ?? 20, 1), 200)));
  for (const [k, v] of Object.entries(q)) {
    if (k === "order" || k === "limit" || v === undefined || v === "") continue;
    p.set(k, String(v));
  }
  return p.toString();
}

async function list<T extends { paging_token: string }>(
  net: Network,
  path: string,
  q: ListQuery,
  revalidate: number,
): Promise<Page<T>> {
  const raw = await get<RawPage<T>>(net, `${path}?${qs(q)}`, q.cursor ? CACHE.medium : revalidate);
  const records = raw._embedded.records;
  return {
    records,
    next: records.length === (q.limit ?? 20) ? cursorOf(raw._links.next?.href) : undefined,
    prev: q.cursor ? cursorOf(raw._links.prev?.href) : undefined,
  };
}

/* ---------- Types (only the fields the site reads) ---------- */

export interface Root {
  horizon_version: string;
  core_version: string;
  history_latest_ledger: number;
  history_latest_ledger_closed_at: string;
  history_elder_ledger: number;
  network_passphrase: string;
  current_protocol_version: number;
}

export interface Ledger {
  id: string;
  paging_token: string;
  hash: string;
  prev_hash: string;
  sequence: number;
  successful_transaction_count: number;
  failed_transaction_count: number;
  operation_count: number;
  tx_set_operation_count: number | null;
  closed_at: string;
  total_coins: string;
  fee_pool: string;
  base_fee_in_stroops: number;
  base_reserve_in_stroops: number;
  max_tx_set_size: number;
  protocol_version: number;
}

export interface Transaction {
  id: string;
  paging_token: string;
  successful: boolean;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  fee_account?: string;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  memo_type: string;
  memo?: string;
  memo_bytes?: string;
  signatures: string[];
  source_account_sequence: string;
}

export interface Operation {
  id: string;
  paging_token: string;
  transaction_successful: boolean;
  source_account: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  [key: string]: unknown;
}

export interface Balance {
  balance: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  liquidity_pool_id?: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
}

export interface Account {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  home_domain?: string;
  last_modified_ledger: number;
  last_modified_time: string;
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  flags: Record<string, boolean>;
  balances: Balance[];
  signers: { weight: number; key: string; type: string }[];
  data: Record<string, string>;
  num_sponsoring: number;
  num_sponsored: number;
  sponsor?: string;
}

export interface Predicate {
  unconditional?: boolean;
  and?: Predicate[];
  or?: Predicate[];
  not?: Predicate;
  abs_before?: string;
  rel_before?: string;
}

export interface ClaimableBalance {
  id: string;
  paging_token: string;
  asset: string;
  amount: string;
  sponsor?: string;
  last_modified_time: string;
  claimants: { destination: string; predicate: Predicate }[];
}

export interface Trade {
  id: string;
  paging_token: string;
  ledger_close_time: string;
  trade_type: string;
  base_account?: string;
  base_amount: string;
  base_asset_type: string;
  base_asset_code?: string;
  base_asset_issuer?: string;
  base_liquidity_pool_id?: string;
  counter_account?: string;
  counter_amount: string;
  counter_asset_type: string;
  counter_asset_code?: string;
  counter_asset_issuer?: string;
  counter_liquidity_pool_id?: string;
  base_is_seller: boolean;
  price?: { n: string; d: string };
}

export interface Asset {
  paging_token: string;
  asset_type: string;
  asset_code: string;
  asset_issuer: string;
  accounts: { authorized: number };
  balances: { authorized: string };
  num_claimable_balances: number;
  num_liquidity_pools: number;
  flags: Record<string, boolean>;
}

export interface LiquidityPool {
  id: string;
  paging_token: string;
  fee_bp: number;
  type: string;
  total_trustlines: string;
  total_shares: string;
  reserves: { asset: string; amount: string }[];
  last_modified_time: string;
}

export interface FeeStats {
  last_ledger: string;
  last_ledger_base_fee: string;
  ledger_capacity_usage: string;
  fee_charged: { min: string; mode: string; p50: string; p90: string; p99: string; max: string };
}

/* ---------- Endpoints ---------- */

export const horizon = {
  root: (net: Network) => get<Root>(net, "/", CACHE.live),
  feeStats: (net: Network) => get<FeeStats>(net, "/fee_stats", CACHE.short),

  ledgers: (net: Network, q: ListQuery = {}) => list<Ledger>(net, "/ledgers", q, CACHE.live),
  /** Uncached reads for the live feed; the CDN in front of /api/latest does the sharing. */
  ledgersFresh: (net: Network, limit: number) => list<Ledger>(net, "/ledgers", { limit }, 0),
  operationsFresh: (net: Network, limit: number) => list<Operation>(net, "/operations", { include_failed: "true", limit }, 0),
  ledger: (net: Network, seq: number) => get<Ledger>(net, `/ledgers/${seq}`, CACHE.immutable),
  ledgerTransactions: (net: Network, seq: number, q: ListQuery = {}) =>
    list<Transaction>(net, `/ledgers/${seq}/transactions`, { include_failed: "true", order: "asc", limit: 50, ...q }, CACHE.immutable),

  transactions: (net: Network, q: ListQuery = {}) =>
    list<Transaction>(net, "/transactions", { include_failed: "true", ...q }, CACHE.live),
  transaction: (net: Network, hash: string) => get<Transaction>(net, `/transactions/${hash}`, CACHE.immutable),
  transactionOperations: (net: Network, hash: string) =>
    list<Operation>(net, `/transactions/${hash}/operations`, { order: "asc", limit: 200 }, CACHE.immutable),

  operations: (net: Network, q: ListQuery = {}) =>
    list<Operation>(net, "/operations", { include_failed: "true", ...q }, CACHE.live),

  account: (net: Network, id: string) => get<Account>(net, `/accounts/${id}`, CACHE.short),
  accountOperations: (net: Network, id: string, q: ListQuery = {}) =>
    list<Operation>(net, `/accounts/${id}/operations`, { include_failed: "true", ...q }, CACHE.short),
  accountTransactions: (net: Network, id: string, q: ListQuery = {}) =>
    list<Transaction>(net, `/accounts/${id}/transactions`, { include_failed: "true", ...q }, CACHE.short),
  accountPayments: (net: Network, id: string, limit = 200) =>
    list<Operation>(net, `/accounts/${id}/payments`, { limit }, CACHE.short),
  accountClaimable: (net: Network, id: string, q: ListQuery = {}) =>
    list<ClaimableBalance>(net, "/claimable_balances", { claimant: id, limit: 200, ...q }, CACHE.short),

  trades: (net: Network, q: ListQuery = {}) => list<Trade>(net, "/trades", q, CACHE.short),
  assets: (net: Network, q: ListQuery = {}) => list<Asset>(net, "/assets", q, CACHE.medium),
  pools: (net: Network, q: ListQuery = {}) => list<LiquidityPool>(net, "/liquidity_pools", q, CACHE.medium),
  claimableBalances: (net: Network, q: ListQuery = {}) =>
    list<ClaimableBalance>(net, "/claimable_balances", q, CACHE.short),
};
