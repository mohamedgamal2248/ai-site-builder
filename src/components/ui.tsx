import Link from "next/link";
import type { ReactNode } from "react";
import { formatAmount, shortId } from "@/lib/format";
import type { Part } from "@/lib/operations";
import { knownWallet } from "@/data/wallets";
import { CopyButton } from "./CopyButton";
import { WalletBadge } from "./WalletBadge";
import { HoverLink } from "./HoverLink";

/** Monospace identifier that never flips direction in RTL pages. */
export function Mono({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <bdi className="mono" dir="ltr" title={title}>
      {children}
    </bdi>
  );
}

export function AccountLink({ id, full = false }: { id: string; full?: boolean }) {
  if (!id) return <span className="muted">—</span>;
  const known = knownWallet(id);
  if (known && !full) {
    return (
      <HoverLink href={`/account/${id}`} className="id-link known" title={id}>
        <WalletBadge logo={known.logo} size={16} />
        <span>{known.label.split(" · ")[0]}</span>
      </HoverLink>
    );
  }
  return (
    <HoverLink href={`/account/${id}`} className="id-link">
      <Mono title={id}>{full ? id : shortId(id, 5, 5)}</Mono>
    </HoverLink>
  );
}

export function TxLink({ hash, full = false }: { hash: string; full?: boolean }) {
  return (
    <HoverLink href={`/tx/${hash}`} className="id-link">
      <Mono title={hash}>{full ? hash : shortId(hash, 6, 6)}</Mono>
    </HoverLink>
  );
}

export function LedgerLink({ seq }: { seq: number | string }) {
  return (
    <HoverLink href={`/blocks/${seq}`} className="id-link">
      <Mono>{Number(seq).toLocaleString("en")}</Mono>
    </HoverLink>
  );
}

export function Amount({ value, asset, max }: { value: string | number | undefined; asset?: string; max?: number }) {
  return (
    <span className="amount">
      <Mono>{formatAmount(value, max)}</Mono>
      {asset ? <span className="asset"> {asset}</span> : null}
    </span>
  );
}

export function Status({ ok, labels }: { ok: boolean; labels: { success: string; failed: string } }) {
  return <span className={`badge ${ok ? "ok" : "bad"}`}>{ok ? labels.success : labels.failed}</span>;
}

export function Copyable({ value, label, copied }: { value: string; label: string; copied: string }) {
  return (
    <span className="copyable">
      <Mono>{value}</Mono>
      <CopyButton value={value} label={label} copied={copied} />
    </span>
  );
}

export function OpSummary({ parts }: { parts: Part[] }) {
  return (
    <span className="op-summary">
      {parts.map((p, i) => {
        if (p.k === "account") return <AccountLink key={i} id={p.v} />;
        if (p.k === "amount") return <Amount key={i} value={p.v} asset={p.asset} />;
        if (p.k === "pool") return <Mono key={i} title={p.v}>{shortId(p.v, 6, 6)}</Mono>;
        return <span key={i}>{p.v}</span>;
      })}
    </span>
  );
}

/** Key/value grid for detail pages. */
export function Facts({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="facts">
      {rows.map(([k, v], i) => (
        <div className="fact" key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface Column<T> {
  label: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** Table on wide screens, stacked cards on phones (labels come from data-label). */
export function DataTable<T>({ columns, rows, rowKey, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty: string }) {
  if (!rows.length) return <p className="muted empty">{empty}</p>;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} className={c.className}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.label} data-label={c.label} className={c.className}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cursor pagination. "Newer" goes back to the first page when we are one step in. */
export function Pager({ base, next, prev, labels }: { base: string; next?: string; prev?: string; labels: { newer: string; older: string; first: string } }) {
  const sep = base.includes("?") ? "&" : "?";
  if (!next && !prev) return null;
  return (
    <nav className="pager">
      {prev ? (
        <>
          <Link href={base} className="btn ghost">{labels.first}</Link>
          <Link href={`${base}${sep}cursor=${encodeURIComponent(prev)}&dir=asc`} className="btn">{labels.newer}</Link>
        </>
      ) : <span />}
      {next ? <Link href={`${base}${sep}cursor=${encodeURIComponent(next)}`} className="btn">{labels.older}</Link> : <span />}
    </nav>
  );
}

export function PageTitle({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="page-title">
      <h1>{title}</h1>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function Card({ title, action, children }: { title?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {title ? (
        <header className="card-head">
          <h2>{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
