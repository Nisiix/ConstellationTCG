-- Accounts & wallets (My Constellation).
--
-- A wallet is an address a person has linked to their account (the Supabase Auth user id; no
-- foreign key because the embedded database has no `auth` schema). Control of the address is
-- proven by signing a one-time challenge; synchronising reads the digital assets the address holds
-- through a public provider and resolves them to printings. The `manual` provider is a
-- wallet-less list of printings a person declares to own. Nothing here stores prices.

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  provider text not null,
  chain text not null,
  address text not null,
  label text,
  verified_at timestamptz,
  challenge_nonce text,
  challenge_expires_at timestamptz,
  sync_status text not null default 'idle',
  sync_error text,
  last_synced_at timestamptz,
  asset_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider, chain, address)
);

create index if not exists wallets_owner_idx on wallets (owner_id);

create table if not exists wallet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  assets_seen integer not null default 0,
  assets_resolved integer not null default 0,
  assets_ambiguous integer not null default 0,
  assets_unresolved integer not null default 0,
  error_message text
);

create index if not exists wallet_sync_runs_wallet_idx on wallet_sync_runs (wallet_id, started_at desc);

alter table digital_ownership add column if not exists wallet_id uuid references wallets(id) on delete cascade;
create index if not exists digital_ownership_wallet_idx on digital_ownership (wallet_id);

-- Hosted database only: people see their own wallets and ownership, never anyone else's.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    return;
  end if;
  execute 'alter table public.wallets enable row level security';
  execute 'alter table public.wallet_sync_runs enable row level security';
  execute 'drop policy if exists "owner" on public.wallets';
  execute 'create policy "owner" on public.wallets for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)';
  execute 'drop policy if exists "owner read" on public.wallet_sync_runs';
  execute 'create policy "owner read" on public.wallet_sync_runs for select to authenticated using (exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = (select auth.uid())))';
  execute 'drop policy if exists "owner read" on public.digital_ownership';
  execute 'create policy "owner read" on public.digital_ownership for select to authenticated using ((select auth.uid()) = owner_id)';
  execute 'drop policy if exists "signed-in read" on public.digital_assets';
  execute 'create policy "signed-in read" on public.digital_assets for select to authenticated using (true)';
  execute 'drop policy if exists "signed-in read" on public.asset_resolution_candidates';
  execute 'create policy "signed-in read" on public.asset_resolution_candidates for select to authenticated using (true)';
end $$;
