import { knownWallet } from "@/data/wallets";
import { shortId } from "@/lib/format";
import { horizon } from "@/lib/horizon";
import { ogCard, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "Pi account";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toUpperCase();
  const known = knownWallet(id);
  try {
    const a = await horizon.account("mainnet", id);
    const bal = Number(a.balances.find((b) => b.asset_type === "native")?.balance ?? 0);
    return ogCard({
      kicker: known ? known.label : "Account",
      title: `${bal.toLocaleString("en", { maximumFractionDigits: 2 })} Pi`,
      lines: [shortId(id, 10, 10)],
    });
  } catch {
    return ogCard({ kicker: known?.label ?? "Account", title: shortId(id, 8, 8), lines: [] });
  }
}
