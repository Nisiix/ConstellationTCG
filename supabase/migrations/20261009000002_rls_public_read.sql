-- Row Level Security for the hosted (Supabase) database.
--
-- The catalog and the graph projection are public, read-only data: anyone holding the
-- publishable key may read them through PostgREST. Provenance (ingestion runs, errors, snapshots)
-- and everything about people stay private: no policy, so the publishable key sees nothing there.
-- The application connects with DATABASE_URL (the table owner, which bypasses RLS) and is not
-- affected.
--
-- The embedded PostgreSQL (PGlite) has no `anon` / `authenticated` roles: the block is a no-op there.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    return;
  end if;
  foreach t in array array[
    'tcg_games', 'tcg_sources', 'tcg_series', 'tcg_sets', 'artists', 'card_identities', 'card_printings',
    'entities', 'printing_entities', 'external_ids', 'graph_nodes', 'graph_edges',
    'ingestion_runs', 'ingestion_errors', 'source_snapshots', 'schema_migrations',
    'digital_assets', 'digital_ownership', 'asset_resolution_candidates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array[
    'tcg_games', 'tcg_sources', 'tcg_series', 'tcg_sets', 'artists', 'card_identities', 'card_printings',
    'entities', 'printing_entities', 'external_ids', 'graph_nodes', 'graph_edges'
  ] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
