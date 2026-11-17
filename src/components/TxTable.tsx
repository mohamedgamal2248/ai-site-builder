import { AccountLink, DataTable, LedgerLink, Status, TxLink } from "@/components/ui";
import { formatDate, stroopsToPi } from "@/lib/format";
import type { Transaction } from "@/lib/horizon";
import type { Settings } from "@/lib/settings";

export function TxTable({ rows, s, hideLedger = false }: { rows: Transaction[]; s: Settings; hideLedger?: boolean }) {
  const { t, lang, native } = s;
  return (
    <DataTable<Transaction>
      rows={rows}
      rowKey={(x) => x.id}
      empty={t.noRecords}
      columns={[
        { label: t.hash, cell: (x) => <TxLink hash={x.hash} /> },
        ...(hideLedger ? [] : [{ label: t.ledger, cell: (x: Transaction) => <LedgerLink seq={x.ledger} /> }]),
        { label: t.source, cell: (x) => <AccountLink id={x.source_account} /> },
        { label: t.opCount, cell: (x) => x.operation_count, className: "num" },
        { label: t.fee, cell: (x) => `${stroopsToPi(x.fee_charged)} ${native}`, className: "num" },
        { label: t.status, cell: (x) => <Status ok={x.successful} labels={t} /> },
        { label: t.time, cell: (x) => formatDate(x.created_at, lang) },
      ]}
    />
  );
}
