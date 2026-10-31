-- ============ Lumora core schema ============

-- Roles (protected, separate table — never on profiles)
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null default 'user',
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  account_type text not null default 'individual',
  country text not null default 'Nigeria',
  two_factor_enabled boolean not null default false,
  email_notifications boolean not null default true,
  push_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_select_admin" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create profile + role + wallet on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Commodities (public reference data)
create table public.commodities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null default 'grain',
  unit text not null default 'kg',
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.commodities to anon, authenticated;
grant all on public.commodities to service_role;
alter table public.commodities enable row level security;
create policy "commodities_public_read" on public.commodities for select to anon, authenticated using (is_active = true);

-- Market price observations (each keeps its source)
create table public.market_prices (
  id uuid primary key default gen_random_uuid(),
  commodity_id uuid references public.commodities(id) on delete cascade not null,
  price numeric(20,4) not null check (price > 0),
  currency text not null default 'NGN',
  unit text not null default 'kg',
  market_location text not null default 'Nigeria',
  source text not null,
  source_kind text not null default 'daily_observation' check (source_kind in ('exchange','daily_observation','weekly_observation','monthly_observation','retail')), 
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_market_prices_commodity on public.market_prices (commodity_id, recorded_at desc);
grant select on public.market_prices to anon, authenticated;
grant all on public.market_prices to service_role;
alter table public.market_prices enable row level security;
create policy "market_prices_public_read" on public.market_prices for select to anon, authenticated using (true);

-- Wallets (amounts in kobo bigint)
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  currency text not null default 'NGN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "wallets_select_own" on public.wallets for select to authenticated using (user_id = auth.uid());

-- Double-entry style ledger
create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entry_type text not null check (entry_type in ('deposit','withdrawal','trade_buy','trade_sell','fee','refund','adjustment')),
  direction text not null check (direction in ('credit','debit')),
  amount_kobo bigint not null check (amount_kobo > 0),
  balance_after_kobo bigint not null,
  reference text not null,
  description text,
  trade_id uuid,
  created_at timestamptz not null default now()
);
create index idx_wallet_ledger_user on public.wallet_ledger (user_id, created_at desc);
grant select on public.wallet_ledger to authenticated;
grant all on public.wallet_ledger to service_role;
alter table public.wallet_ledger enable row level security;
create policy "ledger_select_own" on public.wallet_ledger for select to authenticated using (user_id = auth.uid());

-- Holdings (quantity in kg, cost in kobo)
create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commodity_id uuid references public.commodities(id) on delete cascade not null,
  quantity numeric(20,6) not null default 0 check (quantity >= 0),
  avg_cost_kobo numeric(20,4) not null default 0 check (avg_cost_kobo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, commodity_id)
);
grant select on public.holdings to authenticated;
grant all on public.holdings to service_role;
alter table public.holdings enable row level security;
create policy "holdings_select_own" on public.holdings for select to authenticated using (user_id = auth.uid());

-- Trades
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commodity_id uuid references public.commodities(id) not null,
  side text not null check (side in ('buy','sell')),
  quantity numeric(20,6) not null check (quantity > 0),
  price_per_unit_kobo numeric(20,4) not null check (price_per_unit_kobo > 0),
  fee_kobo bigint not null default 0 check (fee_kobo >= 0),
  total_kobo bigint not null check (total_kobo > 0),
  status text not null default 'completed',
  created_at timestamptz not null default now()
);
create index idx_trades_user on public.trades (user_id, created_at desc);
grant select on public.trades to authenticated;
grant all on public.trades to service_role;
alter table public.trades enable row level security;
create policy "trades_select_own" on public.trades for select to authenticated using (user_id = auth.uid());

-- Deposits (payment provider records)
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tx_ref text unique not null,
  provider text not null default 'flutterwave',
  provider_ref text,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','successful','failed','cancelled')),
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deposits_user on public.deposits (user_id, created_at desc);
grant select, insert on public.deposits to authenticated;
grant all on public.deposits to service_role;
alter table public.deposits enable row level security;
create policy "deposits_select_own" on public.deposits for select to authenticated using (user_id = auth.uid());
create policy "deposits_insert_own" on public.deposits for insert to authenticated with check (user_id = auth.uid());

-- Withdrawals
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  fee_kobo bigint not null default 0 check (fee_kobo >= 0),
  destination_name text not null,
  destination_bank text not null,
  destination_account text not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','rejected')),
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_withdrawals_user on public.withdrawals (user_id, created_at desc);
grant select, insert on public.withdrawals to authenticated;
grant all on public.withdrawals to service_role;
alter table public.withdrawals enable row level security;
create policy "withdrawals_select_own" on public.withdrawals for select to authenticated using (user_id = auth.uid());
create policy "withdrawals_insert_own" on public.withdrawals for insert to authenticated with check (user_id = auth.uid());

-- Physical produce requests
create table public.physical_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commodity_id uuid references public.commodities(id) not null,
  quantity numeric(20,6) not null check (quantity > 0),
  delivery_address text not null,
  delivery_city text not null,
  delivery_state text not null,
  phone text not null,
  note text,
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  quoted_amount_kobo bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_physical_requests_user on public.physical_requests (user_id, created_at desc);
grant select, insert on public.physical_requests to authenticated;
grant all on public.physical_requests to service_role;
alter table public.physical_requests enable row level security;
create policy "physical_requests_select_own" on public.physical_requests for select to authenticated using (user_id = auth.uid());
create policy "physical_requests_insert_own" on public.physical_requests for insert to authenticated with check (user_id = auth.uid());

-- Watchlist
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commodity_id uuid references public.commodities(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, commodity_id)
);
grant select, insert, delete on public.watchlist to authenticated;
grant all on public.watchlist to service_role;
alter table public.watchlist enable row level security;
create policy "watchlist_select_own" on public.watchlist for select to authenticated using (user_id = auth.uid());
create policy "watchlist_insert_own" on public.watchlist for insert to authenticated with check (user_id = auth.uid());
create policy "watchlist_delete_own" on public.watchlist for delete to authenticated using (user_id = auth.uid());

-- Price alerts
create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commodity_id uuid references public.commodities(id) on delete cascade not null,
  direction text not null check (direction in ('above','below')),
  target_price_kobo bigint not null check (target_price_kobo > 0),
  status text not null default 'active' check (status in ('active','triggered','cancelled')),
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.price_alerts to authenticated;
grant all on public.price_alerts to service_role;
alter table public.price_alerts enable row level security;
create policy "alerts_select_own" on public.price_alerts for select to authenticated using (user_id = auth.uid());
create policy "alerts_insert_own" on public.price_alerts for insert to authenticated with check (user_id = auth.uid());
create policy "alerts_update_own" on public.price_alerts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "alerts_delete_own" on public.price_alerts for delete to authenticated using (user_id = auth.uid());

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null default 'system',
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications (user_id, created_at desc);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete_own" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Platform settings (fee schedule etc.)
create table public.platform_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
grant select on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;
alter table public.platform_settings enable row level security;
create policy "settings_read" on public.platform_settings for select to authenticated using (true);

insert into public.platform_settings (key, value) values
  ('trade_fee_bps', '50'),
  ('withdrawal_fee_bps', '100'),
  ('withdrawal_fee_min_kobo', '10000');