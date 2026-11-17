/**
 * Runs the statistics indexer once.
 *   DATABASE_URL=postgres://... npx tsx scripts/ingest.ts [--budget=240] [--net=mainnet,testnet] [--schema]
 * --schema applies db/schema.sql first (safe to repeat).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { ingestAll } from "../src/lib/ingest";
import type { Network } from "../src/lib/horizon";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const local = /localhost|127\.0\.0\.1|host=\//.test(url);
const sql = postgres(url, { max: 1, prepare: false, ssl: local ? false : "require", onnotice: () => {} });
const nets = String(args.net ?? "mainnet").split(",").filter((n): n is Network => n === "mainnet" || n === "testnet");
const budget = Number(args.budget ?? 240) * 1000;

try {
  if (args.schema) {
    const schema = readFileSync(fileURLToPath(new URL("../db/schema.sql", import.meta.url)), "utf8");
    await sql.unsafe(schema);
    console.log("schema applied");
  }
  const { results, maintenance } = await ingestAll(sql, nets, budget);
  console.log("maintenance", maintenance);
  for (const r of results) {
    console.log(`${r.net}/${r.stream}: ${r.records} records in ${r.pages} pages, ${r.caughtUp ? "caught up" : "more to do"}, cursor ${r.cursor || "(start)"}`);
  }
} finally {
  await sql.end();
}
