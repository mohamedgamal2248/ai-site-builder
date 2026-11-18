import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const recent = new Map<string, number>();

/** Stores a browser error report. Capped per IP (instance memory) and per hour (database). */
export async function POST(req: NextRequest) {
  const sql = getDb();
  if (!sql) return new NextResponse(null, { status: 204 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const now = Date.now();
  if ((recent.get(ip) ?? 0) > now - 10_000) return new NextResponse(null, { status: 204 });
  recent.set(ip, now);
  if (recent.size > 2000) recent.clear();
  try {
    const b = (await req.json()) as { message?: string; stack?: string; path?: string; ua?: string };
    const message = String(b.message ?? "").slice(0, 500);
    if (!message) return new NextResponse(null, { status: 204 });
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from client_errors where at > now() - interval '1 hour'`;
    if (n < 200) {
      await sql`insert into client_errors (message, stack, path, ua) values (${message}, ${String(b.stack ?? "").slice(0, 1500)}, ${String(b.path ?? "").slice(0, 200)}, ${String(b.ua ?? "").slice(0, 200)})`;
    }
  } catch {
    /* ignore bad reports */
  }
  return new NextResponse(null, { status: 204 });
}
