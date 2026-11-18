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

-- Daily Pi in/out of each known wallet (exchanges, foundation, whales).
create table if not exists wallet_flows_daily (
  net     text not null,
  address text not null,
  day     date not null,
  inflow  numeric(30, 7) not null default 0,
  outflow numeric(30, 7) not null default 0,
  n_in    integer not null default 0,
  n_out   integer not null default 0,
  primary key (net, address, day)
);

-- One balance per known wallet per UTC day.
create table if not exists wallet_balances (
  net     text not null,
  address text not null,
  day     date not null,
  balance numeric(30, 7) not null,
  primary key (net, address, day)
);

-- Accounts that moved large amounts, with their latest balance (approximate rich list, top 5,000 kept).
create table if not exists holders (
  net        text not null,
  account    text not null,
  balance    numeric(30, 7),
  dirty      boolean not null default true,
  updated_at timestamptz,
  primary key (net, account)
);
create index if not exists holders_balance on holders (net, balance desc nulls last);
create index if not exists holders_dirty on holders (net, updated_at nulls first) where dirty;

-- Web push subscriptions for the watchlist.
create table if not exists push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  net        text not null default 'mainnet',
  addresses  text[] not null default '{}',
  last_seen  jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table wallet_flows_daily enable row level security;
alter table wallet_balances enable row level security;
alter table holders enable row level security;
alter table push_subscriptions enable row level security;

-- Hourly totals for the pressure index: Pi into/out of exchanges, foundation outflows, large deposits.
create table if not exists flows_hourly (
  net           text not null,
  hour          timestamptz not null,
  exch_in       numeric(30, 7) not null default 0,
  exch_out      numeric(30, 7) not null default 0,
  found_out     numeric(30, 7) not null default 0,
  found_to_exch numeric(30, 7) not null default 0,
  large_in_n    integer not null default 0,
  primary key (net, hour)
);

-- One row per hour: market snapshot, top-holder total and the computed index.
create table if not exists signals_hourly (
  net        text not null,
  hour       timestamptz not null,
  price      numeric(20, 8),
  volume_pi  numeric(30, 7),
  book_bid   numeric(30, 7),
  book_ask   numeric(30, 7),
  top_sum    numeric(30, 7),
  score      numeric(6, 2),
  components jsonb,
  primary key (net, hour)
);

-- Notable events: foundation movements, unusual exchange inflows.
create table if not exists alerts (
  net      text not null,
  id       text not null,
  kind     text not null,
  at       timestamptz not null,
  amount   numeric(30, 7),
  from_acc text,
  to_acc   text,
  tx_hash  text,
  meta     jsonb not null default '{}',
  pushed   boolean not null default false,
  primary key (net, id)
);
create index if not exists alerts_time on alerts (net, at desc);

alter table push_subscriptions add column if not exists rules jsonb not null default '[]';
alter table push_subscriptions add column if not exists rule_state jsonb not null default '{}';

alter table flows_hourly enable row level security;
alter table signals_hourly enable row level security;
alter table alerts enable row level security;

-- Browser error reports (our own lightweight error monitoring), kept 14 days.
create table if not exists client_errors (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  message text not null,
  stack   text,
  path    text,
  ua      text
);
create index if not exists client_errors_at on client_errors (at desc);
alter table client_errors enable row level security;

-- Alerts already posted to the Telegram channel.
alter table alerts add column if not exists tg boolean not null default false;
