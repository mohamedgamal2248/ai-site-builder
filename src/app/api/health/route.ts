import { getRepo } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = await getRepo();
  return json({ ok: true, database: repo.kind });
}
