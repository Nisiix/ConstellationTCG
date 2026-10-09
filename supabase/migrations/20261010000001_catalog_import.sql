-- Catalog import as small, resumable steps.
--
-- The whole import (series, every set, the graph projection) is a queue of jobs: one `plan` job
-- lists the sets and decides which changed, one `set` job per set runs the ingestion pipeline for
-- that set, then `graph` jobs rebuild the projection in bounded steps (scaffold nodes, pages of
-- identities, one step per set, pages of reprints, finish). Every step fits a serverless worker
-- (a Supabase Edge Function has 2 s of CPU per request); the CLI drives the same queue.
-- `build_id` on the projection lets a finished build delete the rows an older build left behind.

alter table graph_nodes add column if not exists build_id text;
alter table graph_edges add column if not exists build_id text;

create table if not exists catalog_import_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid,
  game_slug text not null,
  kind text not null check (kind in ('plan', 'set', 'graph')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  priority integer not null default 0,
  position integer not null default 0,
  attempts integer not null default 0,
  set_external_id text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  ingestion_run_id uuid references ingestion_runs(id) on delete set null,
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_import_jobs_queue_idx on catalog_import_jobs (game_slug, status, priority, position);

-- Hosted database: provenance, private (no policy: the publishable key sees nothing here).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'alter table public.catalog_import_jobs enable row level security';
  end if;
end $$;

-- The helpers below are plain SQL / plpgsql and work on the embedded database too. The hosted-only
-- ones (tick, schedule) return early or raise where pg_net, pg_cron or Vault are absent, so their
-- bodies must not be checked against the schema at creation time.
set check_function_bodies = off;

-- Ask for an import. One run at a time per game: while jobs are pending or running the active
-- plan's id is returned (null if the run is past its plan); otherwise a new plan job is queued.
-- `p_full` re-imports every set; the default imports only the sets that changed at the source.
-- (Old runs are pruned by the plan job itself, see packages/catalog-import.)
create or replace function catalog_import_request(p_game_slug text default 'pokemon', p_full boolean default false)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select id into v_id from catalog_import_jobs
    where game_slug = p_game_slug and kind = 'plan' and status in ('pending', 'running')
    order by created_at desc limit 1;
  if v_id is not null then
    return v_id;
  end if;
  if exists (select 1 from catalog_import_jobs where game_slug = p_game_slug and status in ('pending', 'running')) then
    return null;
  end if;
  insert into catalog_import_jobs (game_slug, kind, priority, payload)
    values (p_game_slug, 'plan', 0, jsonb_build_object('full', p_full))
    returning id into v_id;
  update catalog_import_jobs set run_id = v_id where id = v_id;
  return v_id;
end $$;

-- Put the failed jobs of the latest run back in the queue. Returns how many.
create or replace function catalog_import_retry_failed(p_game_slug text default 'pokemon')
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update catalog_import_jobs
    set status = 'pending', attempts = 0, error = null, claimed_at = null, updated_at = now()
    where game_slug = p_game_slug and status = 'failed'
      and run_id = (select id from catalog_import_jobs where game_slug = p_game_slug and kind = 'plan' order by created_at desc limit 1);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Progress of the latest run, in one JSON object.
create or replace function catalog_import_status(p_game_slug text default 'pokemon')
returns jsonb
language sql
stable
as $$
  with run as (
    select id from catalog_import_jobs where game_slug = p_game_slug and kind = 'plan' order by created_at desc limit 1
  ), jobs as (
    select * from catalog_import_jobs j where j.run_id = (select id from run)
  )
  select jsonb_build_object(
    'game', p_game_slug,
    'runId', (select id from run),
    'pending', count(*) filter (where status = 'pending'),
    'running', count(*) filter (where status = 'running'),
    'done', count(*) filter (where status = 'done'),
    'failed', count(*) filter (where status = 'failed'),
    'setsTotal', count(*) filter (where kind = 'set'),
    'setsDone', count(*) filter (where kind = 'set' and status = 'done'),
    'cardsExpected', coalesce(sum((payload->>'cardsExpected')::integer) filter (where kind = 'set'), 0),
    'cardsImported', coalesce(sum(
        coalesce((result->>'created')::integer, 0) + coalesce((result->>'updated')::integer, 0) + coalesce((result->>'unchanged')::integer, 0)
      ) filter (where kind = 'set' and status = 'done'), 0),
    'graphPending', count(*) filter (where kind = 'graph' and status in ('pending', 'running')),
    'lastError', (select e.error from jobs e where e.error is not null order by e.updated_at desc limit 1),
    'startedAt', min(created_at),
    'updatedAt', max(updated_at),
    'finished', count(*) filter (where status in ('pending', 'running')) = 0
  ) from jobs;
$$;

-- Hosted only (pg_net + Vault). One tick = one HTTP call to the catalog-import Edge Function, and
-- only when there is work: a pending job, or a running job whose worker went silent.
create or replace function catalog_import_tick()
returns bigint
language plpgsql
as $$
declare
  v_url text;
  v_token text;
  v_request bigint;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return null;
  end if;
  if not exists (
    select 1 from catalog_import_jobs
    where status = 'pending' or (status = 'running' and claimed_at < now() - interval '10 minutes')
  ) then
    return null;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'catalog_import_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'catalog_import_token';
  if v_url is null or v_token is null then
    return null;
  end if;
  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-catalog-import-token', v_token),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  ) into v_request;
  return v_request;
end $$;

-- Hosted only. Stores the function URL and a random shared token in Vault (the token is generated
-- in the database and never leaves it: pg_cron sends it, the Edge Function reads it back to verify
-- the caller), then schedules the tick and the periodic refresh. pg_net and pg_cron must be
-- enabled first (Database → Extensions).
create or replace function catalog_import_schedule(
  p_function_url text,
  p_tick text default '20 seconds',
  p_refresh_cron text default '15 3 * * 0',
  p_game_slug text default 'pokemon'
)
returns void
language plpgsql
as $$
declare
  v_secret_id uuid;
begin
  if to_regnamespace('net') is null or to_regnamespace('cron') is null or to_regnamespace('vault') is null then
    raise exception 'catalog_import_schedule needs the pg_net, pg_cron and supabase_vault extensions (hosted database)';
  end if;
  if not exists (select 1 from vault.secrets where name = 'catalog_import_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'catalog_import_token',
      'Shared secret between pg_cron and the catalog-import Edge Function');
  end if;
  select id into v_secret_id from vault.secrets where name = 'catalog_import_url';
  if v_secret_id is null then
    perform vault.create_secret(p_function_url, 'catalog_import_url', 'URL of the catalog-import Edge Function');
  else
    perform vault.update_secret(v_secret_id, p_function_url);
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname in ('catalog-import-tick', 'catalog-import-refresh');
  perform cron.schedule('catalog-import-tick', p_tick, 'select public.catalog_import_tick()');
  perform cron.schedule('catalog-import-refresh', p_refresh_cron, format('select public.catalog_import_request(%L, false)', p_game_slug));
end $$;

-- Hosted only. Stops the tick and the refresh; jobs and secrets stay.
create or replace function catalog_import_unschedule()
returns void
language plpgsql
as $$
begin
  if to_regnamespace('cron') is null then
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname in ('catalog-import-tick', 'catalog-import-refresh');
end $$;

reset check_function_bodies;
