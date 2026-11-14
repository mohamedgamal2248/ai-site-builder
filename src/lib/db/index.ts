import { env } from "../env";
import { seedDemo } from "../demo";
import { MemoryRepository } from "./memory";
import { SupabaseRepository } from "./supabase";
import type { Repository } from "./types";

let repo: Repository | null = null;
let seeded: Promise<void> | null = null;

/** Supabase when configured, otherwise an in-memory store seeded with demo products. */
export async function getRepo(): Promise<Repository> {
  if (!repo) {
    if (env.supabaseUrl && env.supabaseServiceKey) {
      if (!env.tokenKey) throw new Error("TOKEN_ENCRYPTION_KEY is required with Supabase");
      repo = new SupabaseRepository(env.supabaseUrl, env.supabaseServiceKey, env.tokenKey);
    } else {
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_DB !== "1") {
        throw new Error("No database configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ALLOW_MEMORY_DB=1 for a demo)");
      }
      const memory = new MemoryRepository();
      repo = memory;
      seeded = process.env.DEMO_DATA === "0" ? Promise.resolve() : seedDemo(memory);
    }
  }
  if (seeded) await seeded;
  return repo;
}

/** Tests use this to start from a clean store. */
export function setRepoForTests(r: Repository | null): void {
  repo = r;
  seeded = null;
}

export type { Repository } from "./types";
