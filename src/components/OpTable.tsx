import { DataTable, OpSummary, Status, TxLink } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Operation } from "@/lib/horizon";
import { opNames } from "@/lib/i18n";
import { summarize } from "@/lib/operations";
import type { Settings } from "@/lib/settings";

export function OpTable({ rows, s, showTx = true }: { rows: Operation[]; s: Settings; showTx?: boolean }) {
  const { t, lang, native } = s;
  return (
    <DataTable<Operation>
      rows={rows}
      rowKey={(o) => o.id}
      empty={t.noRecords}
      columns={[
        { label: t.type, cell: (o) => <strong>{opNames[lang][o.type] ?? o.type}</strong> },
        { label: t.details, cell: (o) => <OpSummary parts={summarize(o, lang, native)} />, className: "wide", m: "plain" },
        ...(showTx ? [{ label: t.transaction, cell: (o: Operation) => <TxLink hash={o.transaction_hash} />, m: "meta" as const }] : []),
        { label: t.status, cell: (o) => <Status ok={o.transaction_successful} labels={t} />, m: "aside" },
        { label: t.time, cell: (o) => formatDate(o.created_at, lang), m: "meta" },
      ]}
    />
  );
}
