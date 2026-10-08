-- Constellation TCG — initial canonical schema.
--
-- The relational database is the source of truth. graph_nodes / graph_edges are a derived
-- projection rebuilt by the graph builder. Nothing here stores prices.

create extension if not exists pg_trgm;

-- ───────────────────────────── games & sources ─────────────────────────────

create table if not exists tcg_games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  publisher text,
  active boolean not null default true,
  adapter_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tcg_sources (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references tcg_games(id) on delete cascade,
  name text not null,
  type text not null,
  base_url text,
  version text,
  priority integer not null default 100,
  enabled boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, name)
);

-- ───────────────────────────── catalog ─────────────────────────────

create table if not exists tcg_series (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references tcg_games(id) on delete cascade,
  source_id uuid not null references tcg_sources(id),
  external_id text not null,
  slug text not null,
  name text not null,
  release_date date,
  logo_url text,
  raw_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id),
  unique (game_id, slug)
);

create table if not exists tcg_sets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references tcg_games(id) on delete cascade,
  series_id uuid not null references tcg_series(id) on delete cascade,
  source_id uuid not null references tcg_sources(id),
  external_id text not null,
  slug text not null,
  name text not null,
  release_date date,
  symbol_url text,
  logo_url text,
  card_count_total integer,
  card_count_official integer,
  raw_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id),
  unique (game_id, slug)
);

create index if not exists tcg_sets_series_idx on tcg_sets (series_id);

create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists card_identities (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references tcg_games(id) on delete cascade,
  canonical_name text not null,
  normalized_name text not null,
  entity_type text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, normalized_name, entity_type)
);

create table if not exists card_printings (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references card_identities(id) on delete cascade,
  set_id uuid not null references tcg_sets(id) on delete cascade,
  source_id uuid not null references tcg_sources(id),
  external_id text not null,
  collector_number text not null,
  printed_number text,
  language text not null default 'en',
  category text,
  rarity text,
  variant text not null default 'standard',
  finish text not null default 'normal',
  artist_id uuid references artists(id),
  image_front text,
  image_back text,
  release_date date,
  attributes jsonb not null default '{}'::jsonb,
  raw_data_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id, language)
);

create index if not exists card_printings_identity_idx on card_printings (identity_id);
create index if not exists card_printings_set_idx on card_printings (set_id);
create index if not exists card_printings_artist_idx on card_printings (artist_id);
create index if not exists card_printings_attributes_gin on card_printings using gin (attributes);

-- Semantic entities that are not cards (Pokémon species, energy types, mechanics...).
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references tcg_games(id) on delete cascade,
  kind text not null,
  key text not null,
  name text not null,
  normalized_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, kind, key)
);

create table if not exists printing_entities (
  printing_id uuid not null references card_printings(id) on delete cascade,
  entity_id uuid not null references entities(id) on delete cascade,
  relation text not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (printing_id, entity_id, relation)
);

create index if not exists printing_entities_entity_idx on printing_entities (entity_id);

create table if not exists external_ids (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  source text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (source, entity_type, external_id)
);

create index if not exists external_ids_entity_idx on external_ids (entity_type, entity_id);

-- ───────────────────────────── graph projection ─────────────────────────────

create table if not exists graph_nodes (
  id text primary key,
  game_id uuid not null references tcg_games(id) on delete cascade,
  node_type text not null,
  entity_id uuid not null,
  label text not null,
  subtitle text,
  image_url text,
  search_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists graph_nodes_game_type_idx on graph_nodes (game_id, node_type);
create index if not exists graph_nodes_entity_idx on graph_nodes (node_type, entity_id);
create index if not exists graph_nodes_search_trgm_idx on graph_nodes using gin (search_text gin_trgm_ops);

create table if not exists graph_edges (
  id text primary key,
  source_node_id text not null references graph_nodes(id) on delete cascade,
  target_node_id text not null references graph_nodes(id) on delete cascade,
  relationship_type text not null,
  weight real not null default 1,
  direction text not null default 'directed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists graph_edges_source_idx on graph_edges (source_node_id);
create index if not exists graph_edges_target_idx on graph_edges (target_node_id);
create index if not exists graph_edges_type_idx on graph_edges (relationship_type);

-- ───────────────────────────── digital assets (phase 2) ─────────────────────────────

create table if not exists digital_assets (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  chain text,
  contract_address text,
  token_id text,
  name text,
  metadata_uri text,
  image_uri text,
  attributes jsonb not null default '{}'::jsonb,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, chain, contract_address, token_id)
);

create table if not exists digital_ownership (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references digital_assets(id) on delete cascade,
  owner_id uuid not null,
  wallet_address text,
  quantity integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  source text not null,
  unique (asset_id, owner_id, wallet_address)
);

create index if not exists digital_ownership_owner_idx on digital_ownership (owner_id);

create table if not exists asset_resolution_candidates (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references digital_assets(id) on delete cascade,
  printing_id uuid not null references card_printings(id) on delete cascade,
  status text not null,
  confidence real not null,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (asset_id, printing_id)
);

-- ───────────────────────────── ingestion & provenance ─────────────────────────────

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references tcg_sources(id),
  mode text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  records_seen integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_unchanged integer not null default 0,
  records_failed integer not null default 0,
  duration_ms integer,
  error_summary text
);

create index if not exists ingestion_runs_source_idx on ingestion_runs (source_id, started_at desc);

create table if not exists ingestion_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references ingestion_runs(id) on delete set null,
  source_id uuid not null references tcg_sources(id),
  record_id text not null,
  error_type text not null,
  payload jsonb,
  message text not null,
  retry_count integer not null default 0,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ingestion_errors_run_idx on ingestion_errors (run_id);

create table if not exists source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references tcg_sources(id),
  record_type text not null,
  record_id text not null,
  content_hash text not null,
  payload jsonb not null,
  retrieved_at timestamptz not null default now(),
  unique (source_id, record_type, record_id)
);
