import { Ago } from "@/components/Ago";
import { AccountLink, Amount, DataTable, TxLink } from "@/components/ui";
import { formatDate, timeAgo } from "@/lib/format";
import type { InsightDict } from "@/lib/i18n-insights";
import type { AlertRow } from "@/lib/insights";

export function AlertList({ rows, x, lang, native, empty }: { rows: AlertRow[]; x: InsightDict; lang: "ar" | "en"; native: string; empty: string }) {
  const now = Date.now();
  return (
    <DataTable<AlertRow>
      rows={rows}
      rowKey={(r) => r.id}
      empty={empty}
      columns={[
        {
          label: x.signal,
          cell: (r) =>
            r.kind === "foundation" ? (
              <span>
                <strong>{x.kindFoundation}</strong>
                <br />
                <span className={r.meta?.dest === "exchange" ? "down" : "muted"}>{x.dest[String(r.meta?.dest ?? "unknown")] ?? x.dest.unknown}</span>
              </span>
            ) : (
              <span>
                <strong className="down">{x.kindSpike}</strong>
                {r.meta?.z ? <span className="muted"> · <bdi dir="ltr">{String(r.meta.z)}σ</bdi></span> : null}
              </span>
            ),
        },
        { label: "Pi", cell: (r) => (r.amount ? <Amount value={Number(r.amount).toFixed(0)} asset={native} /> : "—"), className: "num", m: "aside" },
        {
          label: "→",
          m: "plain",
          cell: (r) =>
            r.from_acc ? (
              <span className="op-summary">
                <AccountLink id={r.from_acc} /> <span className="muted">→</span> {r.to_acc ? <AccountLink id={r.to_acc} /> : "—"}
              </span>
            ) : (
              "—"
            ),
        },
        { label: "⏱", cell: (r) => <Ago iso={r.at} lang={lang} title={formatDate(r.at, lang)} />, m: "meta" },
        { label: "Tx", cell: (r) => (r.tx_hash ? <TxLink hash={r.tx_hash} /> : "—"), m: "meta" },
      ]}
    />
  );
}
