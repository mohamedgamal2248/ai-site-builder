-- Wasl: initial schema. Run in the Supabase SQL editor.
-- The app talks to these tables with the service-role key only; RLS is on with no policies,
-- so the anon key cannot read or write anything.

create extension if not exists pgcrypto;

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('salla', 'zid', 'woocommerce')),
  external_id text not null,
  name text not null,
  domain text not null,
  currency text not null default 'SAR',
  ships_to text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused', 'uninstalled')),
  plan text not null default 'free' check (plan in ('free', 'growth', 'pro')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (platform, external_id)
);

-- OAuth tokens / API keys, AES-256-GCM encrypted by the app (TOKEN_ENCRYPTION_KEY).
create table if not exists store_credentials (
  store_id uuid primary key references stores(id) on delete cascade,
  payload text not null,
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  external_id text not null,
  title text not null,
  description text not null default '',
  brand text,
  url text not null,
  image_url text,
  price numeric(12, 2) not null,
  sale_price numeric(12, 2),
  currency text not null,
  availability text not null check (availability in ('in_stock', 'out_of_stock')),
  quantity integer,
  sku text,
  category text,
  attributes jsonb not null default '{}',
  variants jsonb not null default '[]',
  -- Normalised text (Arabic letter variants folded) written by the app, used for candidate search.
  search_text text not null default '',
  updated_at timestamptz not null default now(),
  unique (store_id, external_id)
);

create extension if not exists pg_trgm;
create index if not exists products_search_trgm on products using gin (search_text gin_trgm_ops);
create index if not exists products_store on products (store_id);

create table if not exists clicks (
  id bigint generated always as identity primary key,
  link_id text not null,
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  agent text,
  created_at timestamptz not null default now()
);
create index if not exists clicks_store_time on clicks (store_id, created_at desc);
create index if not exists clicks_link on clicks (link_id);

create table if not exists orders (
  id bigint generated always as identity primary key,
  store_id uuid not null references stores(id) on delete cascade,
  external_order_id text not null,
  total numeric(12, 2) not null,
  currency text not null,
  status text not null,
  product_external_ids text[] not null default '{}',
  link_id text,
  attribution text not null check (attribution in ('exact', 'probable', 'none')),
  created_at timestamptz not null default now(),
  unique (store_id, external_order_id)
);

alter table stores enable row level security;
alter table store_credentials enable row level security;
alter table products enable row level security;
alter table clicks enable row level security;
alter table orders enable row level security;
