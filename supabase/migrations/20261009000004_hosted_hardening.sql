-- Hosted hardening (from the Supabase advisors).
--
-- * `pg_trgm` lives in the `extensions` schema on hosted projects, where that schema is on every
--   role's search path (the embedded database has no such schema: the block is a no-op there).
-- * Covering indexes for the two foreign keys the linter found unindexed.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions')
     and exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm' and n.nspname = 'public') then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end $$;

create index if not exists asset_resolution_candidates_printing_idx on asset_resolution_candidates (printing_id);
create index if not exists ingestion_errors_source_idx on ingestion_errors (source_id);
