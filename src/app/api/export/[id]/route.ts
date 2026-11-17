import type { NextRequest } from "next/server";
import { horizon, type Network, type Operation, type Transaction } from "@/lib/horizon";
import { summarize } from "@/lib/operations";
import { toActivity } from "@/lib/latest";

export const dynamic = "force-dynamic";

const MAX_PAGES = 5; // 1,000 rows

function cell(v: unknown) {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of an account's latest operations or transactions (up to 1,000 rows). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toUpperCase();
  if (!/^G[A-Z2-7]{55}$/.test(id)) return new Response("bad account id", { status: 400 });
  const type = req.nextUrl.searchParams.get("type") === "txs" ? "txs" : "ops";
  const net: Network = req.cookies.get("net")?.value === "testnet" ? "testnet" : "mainnet";

  const lines: string[] = [];
  let cursor: string | undefined;
  try {
    if (type === "ops") {
      lines.push("time,type,from,to,amount,asset,transaction,successful,details");
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await horizon.accountOperations(net, id, { limit: 200, cursor });
        for (const o of page.records as Operation[]) {
          const from = o.from ?? o.funder ?? o.source_account;
          const to = o.to ?? o.account ?? o.into ?? toActivity(o).to ?? "";
          const amount = o.amount ?? o.starting_balance ?? "";
          const rawAsset = (o.asset_code as string | undefined) ?? (o.asset as string | undefined);
          const asset = o.asset_type === "native" || o.type === "create_account" || rawAsset === "native" ? "Pi" : rawAsset?.split(":")[0] ?? "";
          const details = summarize(o, "en").map((p) => p.v).join(" ");
          lines.push([o.created_at, o.type, from, to, amount, asset, o.transaction_hash, o.transaction_successful, details].map(cell).join(","));
        }
        if (page.records.length < 200) break;
        cursor = page.records[page.records.length - 1].paging_token;
      }
    } else {
      lines.push("time,hash,ledger,source,operations,fee_stroops,successful,memo");
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await horizon.accountTransactions(net, id, { limit: 200, cursor });
        for (const x of page.records as Transaction[]) {
          lines.push([x.created_at, x.hash, x.ledger, x.source_account, x.operation_count, x.fee_charged, x.successful, x.memo ?? ""].map(cell).join(","));
        }
        if (page.records.length < 200) break;
        cursor = page.records[page.records.length - 1].paging_token;
      }
    }
  } catch {
    return new Response("Pi Horizon API unavailable, try again", { status: 502 });
  }
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id.slice(0, 8)}-${type}.csv"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
