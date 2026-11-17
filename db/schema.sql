-- Blockchain Pi statistics schema. Safe to run more than once.
-- Run it once in Supabase (SQL editor) or any Postgres 14+.

create table if not exists sync_state (
  net        text not null,
  stream     text not null,
  cursor     text not null,
  updated_at timestamptz not null default now(),
  primary key (net, stream)
);

-- One row per UTC day.
create table if not exists daily_stats (
  net            text not null,
  day            date not null,
  ledgers        integer not null default 0,
  txs            integer not null default 0,
  failed_txs     integer not null default 0,
  ops            integer not null default 0,
  payments       integer not null default 0,
  payment_volume numeric(30, 7) not null default 0,
  new_accounts   integer not null default 0,
  locks_created  integer not null default 0,
  locked_amount  numeric(30, 7) not null default 0,
  claims         integer not null default 0,
  primary key (net, day)
);

-- Native Pi transfers at or above the "large" threshold.
create table if not exists large_payments (
  net         text not null,
  op_id       text not null,
  tx_hash     text not null,
  ledger_time timestamptz not null,
  from_acc    text,
  to_acc      text,
  amount      numeric(30, 7) not null,
  kind        text not null,
  primary key (net, op_id)
);
create index if not exists large_payments_time on large_payments (net, ledger_time desc);
create index if not exists large_payments_amount on large_payments (net, amount desc);

-- Native Pi claimable balances (lockups). claimed_at is set when the owner claims it.
create table if not exists lockups (
  net        text not null,
  balance_id text not null,
  claimant   text,
  sponsor    text,
  amount     numeric(30, 7) not null,
  unlock_at  timestamptz,
  created_at timestamptz,
  claimed_at timestamptz,
  primary key (net, balance_id)
);
create index if not exists lockups_open_unlock on lockups (net, unlock_at) where claimed_at is null;

-- The site only reads with the server key; block the public API roles entirely.
alter table sync_state enable row level security;
alter table daily_stats enable row level security;
alter table large_payments enable row level security;
alter table lockups enable row level security;
