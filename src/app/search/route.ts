import { NextResponse, type NextRequest } from "next/server";
import { classifySearch } from "@/lib/format";

/** Sends the search box to the right page without a round trip to Horizon. */
export function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  const target = classifySearch(q);
  const path = {
    ledger: `/blocks/${target.value}`,
    tx: `/tx/${target.value}`,
    account: `/account/${target.value}`,
    claimable: `/locked`,
    asset: `/assets?code=${encodeURIComponent(target.value)}`,
    unknown: `/not-found-search`,
  }[target.kind];
  return NextResponse.redirect(new URL(path, req.url), 303);
}
