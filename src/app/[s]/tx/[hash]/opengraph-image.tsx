import { knownWallet } from "@/data/wallets";
import { shortId } from "@/lib/format";
import { horizon } from "@/lib/horizon";
import { ogCard, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "Pi transaction";

const name = (a?: string) => (a ? knownWallet(a)?.label.split(" · ")[0] ?? shortId(a, 5, 5) : "?");

export default async function Image({ params }: { params: Promise<{ hash: string }> }) {
  const hash = (await params).hash.toLowerCase();
  try {
    const [tx, ops] = await Promise.all([horizon.transaction("mainnet", hash), horizon.transactionOperations("mainnet", hash)]);
    const pay = ops.records.find((o) => o.type === "payment" || o.type === "create_account");
    const amount = pay ? Number((pay.amount ?? pay.starting_balance) as string) : null;
    return ogCard({
      cacheSeconds: 60 * 60 * 24 * 365, // a closed transaction never changes
      kicker: `Transaction · ${shortId(tx.hash, 8, 8)}`,
      title: amount !== null ? `${amount.toLocaleString("en", { maximumFractionDigits: 2 })} Pi` : `${tx.operation_count} operation${tx.operation_count === 1 ? "" : "s"}`,
      lines: [
        pay ? `${name((pay.from ?? pay.funder) as string)} → ${name((pay.to ?? pay.account) as string)}` : `From ${name(tx.source_account)}`,
        `${tx.successful ? "Successful" : "Failed"} · block ${tx.ledger.toLocaleString("en")} · ${tx.created_at.replace("T", " ").slice(0, 16)} UTC`,
      ],
    });
  } catch {
    return ogCard({ kicker: "Transaction", title: shortId(hash, 8, 8), lines: [], cacheSeconds: 300 });
  }
}
