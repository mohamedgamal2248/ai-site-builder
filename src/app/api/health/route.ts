import { NextResponse } from "next/server";
import { healthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

/** Machine-readable status for uptime monitors: 200 when nothing is down, 503 otherwise. */
export async function GET() {
  const checks = await healthChecks("mainnet");
  const down = checks.some((c) => c.state === "down");
  return NextResponse.json({ ok: !down, checks }, { status: down ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
