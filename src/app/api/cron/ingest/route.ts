import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ingestAll, shouldSkip } from "@/lib/ingest";
import { checkRules, checkWatchlists } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs the indexer for ~50 seconds. Called by Vercel Cron (with CRON_SECRET as a bearer token)
 * or any external scheduler that sends the same header.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sql = getDb();
  if (!sql) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  if (req.nextUrl.searchParams.get("force") !== "1" && (await shouldSkip(sql, "mainnet"))) {
    return NextResponse.json({ skipped: true }, { headers: { "Cache-Control": "no-store" } });
  }
  const out = await ingestAll(sql, ["mainnet"], 50_000, async (db, net, deadline) => ({
    watchlist: await checkWatchlists(db, net, deadline),
    rules: await checkRules(db, net),
  }));
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
