import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpTable } from "@/components/OpTable";
import { AccountLink, Card, Copyable, Facts, LedgerLink, Mono, PageTitle, Status } from "@/components/ui";
import { formatDate, shortId, stroopsToPi } from "@/lib/format";
import { found } from "@/lib/found";
import { horizon, type Transaction } from "@/lib/horizon";
import { getSettings } from "@/lib/settings";

// Rendered on first visit, then served from the CDN.
export async function generateStaticParams() {
  return [];
}
export const revalidate = 31536000;

type Params = Promise<{ s: string; hash: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `Transaction ${shortId((await params).hash, 8, 8)}` };
}

function memoText(tx: Transaction, none: string) {
  if (tx.memo_type === "none" || tx.memo === undefined) return none;
  return `${tx.memo} (${tx.memo_type})`;
}

export default async function TxPage({ params }: { params: Params }) {
  const s = await getSettings(params);
  const { t, net, lang, native } = s;
  const { hash } = await params;
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) notFound();

  const [tx, ops] = await Promise.all([
    found(horizon.transaction(net, hash.toLowerCase())),
    found(horizon.transactionOperations(net, hash.toLowerCase())),
  ]);

  return (
    <>
      <PageTitle title={t.transaction} sub={<Mono>{shortId(tx.hash, 10, 10)}</Mono>} />
      <Card>
        <Facts
          rows={[
            [t.hash, <Copyable key="h" value={tx.hash} label={t.copy} copied={t.copied} />],
            [t.status, <Status key="s" ok={tx.successful} labels={t} />],
            [t.ledger, <LedgerLink key="l" seq={tx.ledger} />],
            [t.time, formatDate(tx.created_at, lang)],
            [t.source, <AccountLink key="a" id={tx.source_account} full />],
            ...(tx.fee_account && tx.fee_account !== tx.source_account
              ? [[t.feeAccount, <AccountLink key="fa" id={tx.fee_account} full />] as [string, React.ReactNode]]
              : []),
            [t.fee, `${stroopsToPi(tx.fee_charged)} ${native} · ${t.maxFee} ${stroopsToPi(tx.max_fee)}`],
            [t.memo, <bdi key="m" dir="auto">{memoText(tx, t.none)}</bdi>],
            [t.opCount, tx.operation_count],
            [t.signatures, tx.signatures.length],
            [t.sourceSeq, <Mono key="q">{tx.source_account_sequence}</Mono>],
          ]}
        />
      </Card>
      <Card title={`${t.operations} (${ops.records.length})`}>
        <OpTable rows={ops.records} s={s} showTx={false} />
      </Card>
    </>
  );
}
