import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TxTable } from "@/components/TxTable";
import { Amount, Card, Copyable, Facts, Mono, PageTitle, Pager } from "@/components/ui";
import { formatDate, stroopsToPi } from "@/lib/format";
import { found, type SearchParams } from "@/lib/found";
import { horizon } from "@/lib/horizon";
import { paged, readPageParams } from "@/lib/paging";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Params = Promise<{ seq: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `Block #${(await params).seq}` };
}

export default async function BlockPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const s = await getSettings();
  const { t, net, lang, native } = s;
  const { seq: raw } = await params;
  if (!/^\d{1,12}$/.test(raw)) notFound();
  const seq = Number(raw);

  const [ledger, txs] = await Promise.all([
    found(horizon.ledger(net, seq)),
    found(paged((q) => horizon.ledgerTransactions(net, seq, q), readPageParams(await searchParams), 50)),
  ]);

  return (
    <>
      <PageTitle
        title={
          <>
            {t.block} <Mono>#{seq.toLocaleString("en")}</Mono>
          </>
        }
        sub={
          <span style={{ display: "inline-flex", gap: 12 }}>
            {seq > 1 ? <Link href={`/blocks/${seq - 1}`}>{lang === "ar" ? "→" : "←"} #{seq - 1}</Link> : null}
            <Link href={`/blocks/${seq + 1}`}>#{seq + 1} {lang === "ar" ? "←" : "→"}</Link>
          </span>
        }
      />
      <Card>
        <Facts
          rows={[
            [t.closedAt, formatDate(ledger.closed_at, lang)],
            [t.hash, <Copyable key="h" value={ledger.hash} label={t.copy} copied={t.copied} />],
            [t.prevHash, <Mono key="p">{ledger.prev_hash}</Mono>],
            [t.txCount, `${ledger.successful_transaction_count} ${t.success} · ${ledger.failed_transaction_count} ${t.failedTx}`],
            [t.opCount, ledger.operation_count],
            [t.totalSupply, <Amount key="c" value={ledger.total_coins} asset={native} />],
            [t.feePool, <Amount key="f" value={ledger.fee_pool} asset={native} />],
            [t.baseFee, `${stroopsToPi(ledger.base_fee_in_stroops)} ${native} (${ledger.base_fee_in_stroops} ${t.stroops})`],
            [t.baseReserve, `${stroopsToPi(ledger.base_reserve_in_stroops)} ${native}`],
            [t.maxTxSet, ledger.max_tx_set_size],
            [t.protocol, `v${ledger.protocol_version}`],
          ]}
        />
      </Card>
      <Card title={t.transactions}>
        <TxTable rows={txs.records} s={s} hideLedger />
        <Pager base={`/blocks/${seq}`} next={txs.next} prev={txs.prev} labels={t} />
      </Card>
    </>
  );
}
