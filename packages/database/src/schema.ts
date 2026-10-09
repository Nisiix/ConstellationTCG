/**
 * Drizzle schema — a typed mirror of `supabase/migrations/*.sql`.
 *
 * The SQL migrations are the source of truth for the database structure; this file must be kept
 * in sync with them. The `schema-drift` test applies the migrations to an embedded database and
 * compares every column declared here against `information_schema`.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

type Json = Record<string, unknown>

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
}

export const tcgGames = pgTable('tcg_games', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  publisher: text('publisher'),
  active: boolean('active').notNull().default(true),
  adapterKey: text('adapter_key').notNull(),
  ...timestamps,
})

export const tcgSources = pgTable(
  'tcg_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => tcgGames.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    baseUrl: text('base_url'),
    version: text('version'),
    priority: integer('priority').notNull().default(100),
    enabled: boolean('enabled').notNull().default(true),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true, mode: 'string' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('tcg_sources_game_id_name_key').on(t.gameId, t.name)],
)

export const tcgSeries = pgTable(
  'tcg_series',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => tcgGames.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => tcgSources.id),
    externalId: text('external_id').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    releaseDate: date('release_date', { mode: 'string' }),
    logoUrl: text('logo_url'),
    rawHash: text('raw_hash').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('tcg_series_source_id_external_id_key').on(t.sourceId, t.externalId),
    uniqueIndex('tcg_series_game_id_slug_key').on(t.gameId, t.slug),
  ],
)

export const tcgSets = pgTable(
  'tcg_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => tcgGames.id, { onDelete: 'cascade' }),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => tcgSeries.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => tcgSources.id),
    externalId: text('external_id').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    releaseDate: date('release_date', { mode: 'string' }),
    symbolUrl: text('symbol_url'),
    logoUrl: text('logo_url'),
    cardCountTotal: integer('card_count_total'),
    cardCountOfficial: integer('card_count_official'),
    rawHash: text('raw_hash').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('tcg_sets_source_id_external_id_key').on(t.sourceId, t.externalId),
    uniqueIndex('tcg_sets_game_id_slug_key').on(t.gameId, t.slug),
    index('tcg_sets_series_idx').on(t.seriesId),
  ],
)

export const artists = pgTable('artists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(),
  createdAt: timestamps.createdAt,
})

export const cardIdentities = pgTable(
  'card_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => tcgGames.id, { onDelete: 'cascade' }),
    canonicalName: text('canonical_name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    entityType: text('entity_type').notNull(),
    description: text('description'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('card_identities_game_id_normalized_name_entity_type_key').on(
      t.gameId,
      t.normalizedName,
      t.entityType,
    ),
  ],
)

export const cardPrintings = pgTable(
  'card_printings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id')
      .notNull()
      .references(() => cardIdentities.id, { onDelete: 'cascade' }),
    setId: uuid('set_id')
      .notNull()
      .references(() => tcgSets.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => tcgSources.id),
    externalId: text('external_id').notNull(),
    collectorNumber: text('collector_number').notNull(),
    printedNumber: text('printed_number'),
    language: text('language').notNull().default('en'),
    category: text('category'),
    rarity: text('rarity'),
    variant: text('variant').notNull().default('standard'),
    finish: text('finish').notNull().default('normal'),
    artistId: uuid('artist_id').references(() => artists.id),
    imageFront: text('image_front'),
    imageBack: text('image_back'),
    releaseDate: date('release_date', { mode: 'string' }),
    attributes: jsonb('attributes').$type<Json>().notNull().default({}),
    rawDataHash: text('raw_data_hash').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('card_printings_source_id_external_id_language_key').on(
      t.sourceId,
      t.externalId,
      t.language,
    ),
    index('card_printings_identity_idx').on(t.identityId),
    index('card_printings_set_idx').on(t.setId),
    index('card_printings_artist_idx').on(t.artistId),
  ],
)

export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => tcgGames.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    metadata: jsonb('metadata').$type<Json>().notNull().default({}),
    ...timestamps,
  },
  (t) => [uniqueIndex('entities_game_id_kind_key_key').on(t.gameId, t.kind, t.key)],
)

export const printingEntities = pgTable(
  'printing_entities',
  {
    printingId: uuid('printing_id')
      .notNull()
      .references(() => cardPrintings.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull(),
    metadata: jsonb('metadata').$type<Json>().notNull().default({}),
  },
  (t) => [
    primaryKey({ columns: [t.printingId, t.entityId, t.relation] }),
    index('printing_entities_entity_idx').on(t.entityId),
  ],
)

export const externalIds = pgTable(
  'external_ids',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex('external_ids_source_entity_type_external_id_key').on(
      t.source,
      t.entityType,
      t.externalId,
    ),
    index('external_ids_entity_idx').on(t.entityType, t.entityId),
  ],
)

export const graphNodes = pgTable(
  'graph_nodes',
  {
    id: text('id').primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => tcgGames.id, { onDelete: 'cascade' }),
    nodeType: text('node_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    label: text('label').notNull(),
    subtitle: text('subtitle'),
    imageUrl: text('image_url'),
    searchText: text('search_text').notNull(),
    metadata: jsonb('metadata').$type<Json>().notNull().default({}),
    /** The projection build that last wrote the row; rows of an older build are stale. */
    buildId: text('build_id'),
    ...timestamps,
  },
  (t) => [
    index('graph_nodes_game_type_idx').on(t.gameId, t.nodeType),
    index('graph_nodes_entity_idx').on(t.nodeType, t.entityId),
  ],
)

export const graphEdges = pgTable(
  'graph_edges',
  {
    id: text('id').primaryKey(),
    sourceNodeId: text('source_node_id')
      .notNull()
      .references(() => graphNodes.id, { onDelete: 'cascade' }),
    targetNodeId: text('target_node_id')
      .notNull()
      .references(() => graphNodes.id, { onDelete: 'cascade' }),
    relationshipType: text('relationship_type').notNull(),
    weight: real('weight').notNull().default(1),
    direction: text('direction').notNull().default('directed'),
    metadata: jsonb('metadata').$type<Json>().notNull().default({}),
    buildId: text('build_id'),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('graph_edges_source_idx').on(t.sourceNodeId),
    index('graph_edges_target_idx').on(t.targetNodeId),
    index('graph_edges_type_idx').on(t.relationshipType),
  ],
)

/**
 * An address a person linked to their account (My Constellation). `owner_id` is the Supabase Auth
 * user id (no foreign key: the embedded database has no `auth` schema). Control of the address is
 * proven by signing a one-time challenge (`challenge_nonce`) → `verified_at`.
 */
export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull(),
    provider: text('provider').notNull(),
    chain: text('chain').notNull(),
    address: text('address').notNull(),
    label: text('label'),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'string' }),
    challengeNonce: text('challenge_nonce'),
    challengeExpiresAt: timestamp('challenge_expires_at', { withTimezone: true, mode: 'string' }),
    syncStatus: text('sync_status').notNull().default('idle'),
    syncError: text('sync_error'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'string' }),
    assetCount: integer('asset_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('wallets_owner_id_provider_chain_address_key').on(t.ownerId, t.provider, t.chain, t.address),
    index('wallets_owner_idx').on(t.ownerId),
  ],
)

export const walletSyncRuns = pgTable(
  'wallet_sync_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    status: text('status').notNull().default('running'),
    assetsSeen: integer('assets_seen').notNull().default(0),
    assetsResolved: integer('assets_resolved').notNull().default(0),
    assetsAmbiguous: integer('assets_ambiguous').notNull().default(0),
    assetsUnresolved: integer('assets_unresolved').notNull().default(0),
    errorMessage: text('error_message'),
  },
  (t) => [index('wallet_sync_runs_wallet_idx').on(t.walletId, t.startedAt)],
)

export const digitalAssets = pgTable(
  'digital_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platform: text('platform').notNull(),
    chain: text('chain'),
    contractAddress: text('contract_address'),
    tokenId: text('token_id'),
    name: text('name'),
    metadataUri: text('metadata_uri'),
    imageUri: text('image_uri'),
    attributes: jsonb('attributes').$type<Json>().notNull().default({}),
    rawMetadata: jsonb('raw_metadata').$type<Json>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('digital_assets_platform_chain_contract_address_token_id_key').on(
      t.platform,
      t.chain,
      t.contractAddress,
      t.tokenId,
    ),
  ],
)

export const digitalOwnership = pgTable(
  'digital_ownership',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => digitalAssets.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id').notNull(),
    walletAddress: text('wallet_address'),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    firstSeen: timestamp('first_seen', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    source: text('source').notNull(),
  },
  (t) => [
    uniqueIndex('digital_ownership_asset_id_owner_id_wallet_address_key').on(
      t.assetId,
      t.ownerId,
      t.walletAddress,
    ),
    index('digital_ownership_owner_idx').on(t.ownerId),
    index('digital_ownership_wallet_idx').on(t.walletId),
  ],
)

export const assetResolutionCandidates = pgTable(
  'asset_resolution_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => digitalAssets.id, { onDelete: 'cascade' }),
    printingId: uuid('printing_id')
      .notNull()
      .references(() => cardPrintings.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    confidence: real('confidence').notNull(),
    reasons: jsonb('reasons').$type<unknown[]>().notNull().default([]),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex('asset_resolution_candidates_asset_id_printing_id_key').on(
      t.assetId,
      t.printingId,
    ),
    index('asset_resolution_candidates_printing_idx').on(t.printingId),
  ],
)

export const ingestionRuns = pgTable(
  'ingestion_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => tcgSources.id),
    mode: text('mode').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    status: text('status').notNull().default('running'),
    recordsSeen: integer('records_seen').notNull().default(0),
    recordsCreated: integer('records_created').notNull().default(0),
    recordsUpdated: integer('records_updated').notNull().default(0),
    recordsUnchanged: integer('records_unchanged').notNull().default(0),
    recordsFailed: integer('records_failed').notNull().default(0),
    durationMs: integer('duration_ms'),
    errorSummary: text('error_summary'),
  },
  (t) => [index('ingestion_runs_source_idx').on(t.sourceId, t.startedAt)],
)

export const ingestionErrors = pgTable(
  'ingestion_errors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').references(() => ingestionRuns.id, { onDelete: 'set null' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => tcgSources.id),
    recordId: text('record_id').notNull(),
    errorType: text('error_type').notNull(),
    payload: jsonb('payload').$type<unknown>(),
    message: text('message').notNull(),
    retryCount: integer('retry_count').notNull().default(0),
    resolved: boolean('resolved').notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('ingestion_errors_run_idx').on(t.runId), index('ingestion_errors_source_idx').on(t.sourceId)],
)

/**
 * The catalog import as a queue of small, resumable jobs: a `plan` job lists the sets and decides
 * which changed, one `set` job per set runs the pipeline for that set, then `graph` jobs rebuild
 * the projection in bounded steps. Each step fits a serverless worker; the CLI drives the same
 * queue. `run_id` is the id of the plan job that spawned the run.
 */
export const catalogImportJobs = pgTable(
  'catalog_import_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id'),
    gameSlug: text('game_slug').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('pending'),
    priority: integer('priority').notNull().default(0),
    position: integer('position').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),
    setExternalId: text('set_external_id'),
    payload: jsonb('payload').$type<Json>().notNull().default({}),
    result: jsonb('result').$type<Json>().notNull().default({}),
    error: text('error'),
    ingestionRunId: uuid('ingestion_run_id').references(() => ingestionRuns.id, { onDelete: 'set null' }),
    claimedAt: timestamp('claimed_at', { withTimezone: true, mode: 'string' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    ...timestamps,
  },
  (t) => [index('catalog_import_jobs_queue_idx').on(t.gameSlug, t.status, t.priority, t.position)],
)

export const sourceSnapshots = pgTable(
  'source_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => tcgSources.id),
    recordType: text('record_type').notNull(),
    recordId: text('record_id').notNull(),
    contentHash: text('content_hash').notNull(),
    payload: jsonb('payload').$type<unknown>().notNull(),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('source_snapshots_source_id_record_type_record_id_key').on(
      t.sourceId,
      t.recordType,
      t.recordId,
    ),
  ],
)

export const schema = {
  tcgGames,
  tcgSources,
  tcgSeries,
  tcgSets,
  artists,
  cardIdentities,
  cardPrintings,
  entities,
  printingEntities,
  externalIds,
  graphNodes,
  graphEdges,
  wallets,
  walletSyncRuns,
  digitalAssets,
  digitalOwnership,
  assetResolutionCandidates,
  ingestionRuns,
  ingestionErrors,
  catalogImportJobs,
  sourceSnapshots,
}

export type Schema = typeof schema
