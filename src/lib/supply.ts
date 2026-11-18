/**
 * Pi mainnet supply figures as published by Pi's own block explorer (blockexplorer.minepi.com
 * reads the same endpoint). Server-side and cached 10 minutes, so visitors never call it.
 */
export interface MainnetSupply {
  migrated: number;
  locked: number;
  unlocked: number;
  circulating: number;
  effectiveTotal: number;
  max: number;
  updatedAt: string | null;
}

export async function getMainnetSupply(): Promise<MainnetSupply | null> {
  try {
    const res = await fetch("https://socialchain.app/mainnet_supply", { next: { revalidate: 600 }, signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as { migrated_mining_rewards?: number; total_locked?: number; circulating_supply?: number; total_supply?: number; updated_at?: string };
    const migrated = Number(j.migrated_mining_rewards);
    const locked = Number(j.total_locked);
    if (!Number.isFinite(migrated) || !Number.isFinite(locked) || migrated <= 0) return null;
    return {
      migrated,
      locked,
      unlocked: migrated - locked,
      circulating: Number(j.circulating_supply ?? migrated),
      effectiveTotal: Number(j.total_supply ?? migrated / 0.65),
      max: 100_000_000_000,
      updatedAt: j.updated_at ?? null,
    };
  } catch {
    return null;
  }
}
