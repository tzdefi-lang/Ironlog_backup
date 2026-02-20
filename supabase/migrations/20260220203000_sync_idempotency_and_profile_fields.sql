begin;

create table if not exists public.sync_operation_receipts (
  id bigserial primary key,
  user_id text not null,
  idempotency_key text not null,
  table_name text not null,
  action text not null,
  payload_hash text not null,
  applied boolean not null default false,
  last_error text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

alter table public.sync_operation_receipts
  add column if not exists table_name text,
  add column if not exists action text,
  add column if not exists payload_hash text,
  add column if not exists applied boolean not null default false,
  add column if not exists last_error text,
  add column if not exists applied_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_sync_receipts_user_created
  on public.sync_operation_receipts (user_id, created_at desc);

create index if not exists idx_sync_receipts_applied
  on public.sync_operation_receipts (applied, updated_at desc);

create table if not exists public.user_profiles (
  user_id text primary key,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  subscription_tier text,
  subscription_status text,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists last_login_at timestamptz,
  add column if not exists subscription_tier text,
  add column if not exists subscription_status text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_profiles
  alter column subscription_tier set default 'free',
  alter column subscription_status set default 'active';

update public.user_profiles
set created_at = coalesce(created_at, now()),
    subscription_tier = coalesce(nullif(subscription_tier, ''), 'free'),
    subscription_status = coalesce(nullif(subscription_status, ''), 'active')
where true;

create or replace function public.sync_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_receipts_updated_at on public.sync_operation_receipts;
create trigger trg_sync_receipts_updated_at
before update on public.sync_operation_receipts
for each row execute function public.sync_touch_updated_at();

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.sync_touch_updated_at();

alter table public.sync_operation_receipts enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "Users view own sync receipts" on public.sync_operation_receipts;
create policy "Users view own sync receipts"
  on public.sync_operation_receipts
  for select
  using (auth.uid()::text = user_id);

drop policy if exists "Users write own sync receipts" on public.sync_operation_receipts;
create policy "Users write own sync receipts"
  on public.sync_operation_receipts
  for insert
  with check (auth.uid()::text = user_id);

drop policy if exists "Users update own sync receipts" on public.sync_operation_receipts;
create policy "Users update own sync receipts"
  on public.sync_operation_receipts
  for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists "Users manage own user_profiles" on public.user_profiles;
create policy "Users manage own user_profiles"
  on public.user_profiles
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

commit;
