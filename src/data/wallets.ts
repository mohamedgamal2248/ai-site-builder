/**
 * Publicly identified wallets shown on /wallets with live balances.
 * Only add an address with a public, checkable source (an official announcement,
 * an exchange's published proof-of-reserves, etc.). Do not guess.
 */
export interface KnownWallet {
  address: string;
  label: string;
  category: "core-team" | "exchange" | "foundation" | "other";
  source: string;
}

export const knownWallets: KnownWallet[] = [];
