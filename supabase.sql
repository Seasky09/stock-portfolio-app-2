create extension if not exists pgcrypto;

create table if not exists public.portfolio_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  stock_name text not null,
  ticker text not null,
  type text not null check (type in ('buy','sell')),
  qty numeric not null check (qty > 0),
  price numeric not null check (price > 0),
  fee numeric not null default 0 check (fee >= 0),
  tax numeric not null default 0 check (tax >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  price numeric not null default 0 check (price >= 0),
  updated_at timestamptz not null default now(),
  unique(user_id, ticker)
);

alter table public.portfolio_trades enable row level security;
alter table public.portfolio_prices enable row level security;

drop policy if exists trades_select on public.portfolio_trades;
drop policy if exists trades_insert on public.portfolio_trades;
drop policy if exists trades_update on public.portfolio_trades;
drop policy if exists trades_delete on public.portfolio_trades;

create policy trades_select on public.portfolio_trades for select using (auth.uid() = user_id);
create policy trades_insert on public.portfolio_trades for insert with check (auth.uid() = user_id);
create policy trades_update on public.portfolio_trades for update using (auth.uid() = user_id);
create policy trades_delete on public.portfolio_trades for delete using (auth.uid() = user_id);

drop policy if exists prices_select on public.portfolio_prices;
drop policy if exists prices_insert on public.portfolio_prices;
drop policy if exists prices_update on public.portfolio_prices;
drop policy if exists prices_delete on public.portfolio_prices;

create policy prices_select on public.portfolio_prices for select using (auth.uid() = user_id);
create policy prices_insert on public.portfolio_prices for insert with check (auth.uid() = user_id);
create policy prices_update on public.portfolio_prices for update using (auth.uid() = user_id);
create policy prices_delete on public.portfolio_prices for delete using (auth.uid() = user_id);
