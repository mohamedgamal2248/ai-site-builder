import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ingestAll } from "@/lib/ingest";
import { checkWatchlists } from "@/lib/push";

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
  const out = await ingestAll(sql, ["mainnet"], 50_000, checkWatchlists);
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
