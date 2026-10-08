/**
 * Ingestion pipeline.
 *
 *   FETCH → RAW SNAPSHOT → NORMALIZE → VALIDATE → IDENTITY RESOLUTION → PRINTING RESOLUTION → UPSERT
 *
 * Every run is recorded in `ingestion_runs`; every failed record goes to `ingestion_errors` and
 * never blocks the rest of the run. Unchanged records (same content hash) are skipped, which makes
 * the same code path serve both full and incremental imports.
 */
import { contentHash } from '@constellation/adapters'
import {
  and,
  artists,
  cardIdentities,
  cardPrintings,
  entities,
  eq,
  externalIds,
  ingestionErrors,
  ingestionRuns,
  printingEntities,
  sourceSnapshots,
  tcgSeries,
  tcgSets,
  tcgSources,
  type Database,
  type Db,
} from '@constellation/database'
import {
  ConstellationError,
  emptyCounters,
  normalizeName,
  slugify,
  type IngestionCounters,
  type IngestionErrorType,
  type IngestionMode,
  type NormalizedCard,
  type SourceType,
  type TCGAdapter,
} from '@constellation/domain'
import { ensureGame, ensureSource } from './bootstrap'
import { validateNormalizedCard } from './validate'

export interface IngestionOptions {
  database: Database
  adapter: TCGAdapter
  mode: IngestionMode
  source: { name: string; type: SourceType; baseUrl?: string | null; version?: string | null }
  /** Restrict card ingestion to these set external ids (vertical slice / fixtures). */
  setExternalIds?: string[]
  log?: (message: string) => void
  /** Called with (done, total) while cards are fetched. */
  onProgress?: (done: number, total: number) => void
}

export interface IngestionReport {
  runId: string
  gameId: string
  sourceId: string
  status: 'succeeded' | 'partial' | 'failed'
  series: IngestionCounters
  sets: IngestionCounters
  cards: IngestionCounters
  errors: number
  durationMs: number
}

type Log = (message: string) => void

const noop = () => {}

export async function runIngestion(options: IngestionOptions): Promise<IngestionReport> {
  const { database, adapter } = options
  const db = database.db
  const log: Log = options.log ?? noop
  const startedAt = Date.now()

  const definition = adapter.definition()
  const game = await ensureGame(db, definition)
  const source = await ensureSource(db, game.id, options.source)

  const [run] = await db
    .insert(ingestionRuns)
    .values({ sourceId: source.id, mode: options.mode, status: 'running' })
    .returning({ id: ingestionRuns.id })
  if (!run) throw new Error('Could not create ingestion run')

  const ctx: Context = {
    db,
    adapter,
    gameId: game.id,
    sourceId: source.id,
    runId: run.id,
    log,
    errors: 0,
  }

  const report: IngestionReport = {
    runId: run.id,
    gameId: game.id,
    sourceId: source.id,
    status: 'succeeded',
    series: emptyCounters(),
    sets: emptyCounters(),
    cards: emptyCounters(),
    errors: 0,
    durationMs: 0,
  }

  try {
    log('ingesting series')
    const seriesMap = await ingestSeries(ctx, report.series)
    log(`series: ${describe(report.series)}`)

    log('ingesting sets')
    const setMap = await ingestSets(ctx, seriesMap, report.sets, options.setExternalIds)
    log(`sets: ${describe(report.sets)}`)

    log('ingesting cards')
    await ingestCards(ctx, setMap, report.cards, options)
    log(`cards: ${describe(report.cards)}`)

    report.errors = ctx.errors
    report.status = ctx.errors > 0 ? 'partial' : 'succeeded'
  } catch (error) {
    report.errors = ctx.errors
    report.status = 'failed'
    report.durationMs = Date.now() - startedAt
    await finalizeRun(ctx, report, error instanceof Error ? error.message : String(error))
    throw error
  }

  report.durationMs = Date.now() - startedAt
  await finalizeRun(ctx, report, null)
  await db
    .update(tcgSources)
    .set({ lastSyncAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(tcgSources.id, source.id))
  return report
}

interface Context {
  db: Db
  adapter: TCGAdapter
  gameId: string
  sourceId: string
  runId: string
  log: Log
  errors: number
}

function describe(c: IngestionCounters): string {
  return `${c.seen} seen, ${c.created} created, ${c.updated} updated, ${c.unchanged} unchanged, ${c.failed} failed`
}

async function finalizeRun(ctx: Context, report: IngestionReport, errorSummary: string | null) {
  const total = (k: keyof IngestionCounters) =>
    report.series[k] + report.sets[k] + report.cards[k]
  await ctx.db
    .update(ingestionRuns)
    .set({
      finishedAt: new Date().toISOString(),
      status: report.status,
      recordsSeen: total('seen'),
      recordsCreated: total('created'),
      recordsUpdated: total('updated'),
      recordsUnchanged: total('unchanged'),
      recordsFailed: total('failed'),
      durationMs: report.durationMs,
      errorSummary,
    })
    .where(eq(ingestionRuns.id, ctx.runId))
}

function classify(error: unknown): IngestionErrorType {
  if (error instanceof ConstellationError) {
    switch (error.layer) {
      case 'source':
      case 'validation':
      case 'normalization':
      case 'identity_resolution':
      case 'printing_resolution':
      case 'database':
        return error.layer
    }
  }
  return 'unknown'
}

async function recordError(ctx: Context, recordId: string, error: unknown, payload: unknown) {
  ctx.errors += 1
  const message = error instanceof Error ? error.message : String(error)
  ctx.log(`error [${recordId}] ${message}`)
  await ctx.db.insert(ingestionErrors).values({
    runId: ctx.runId,
    sourceId: ctx.sourceId,
    recordId,
    errorType: classify(error),
    payload: safeJson(payload),
    message,
  })
}

function safeJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value ?? null))
  } catch {
    return null
  }
}

async function snapshot(ctx: Context, recordType: string, recordId: string, hash: string, payload: unknown) {
  await ctx.db
    .insert(sourceSnapshots)
    .values({
      sourceId: ctx.sourceId,
      recordType,
      recordId,
      contentHash: hash,
      payload: safeJson(payload),
    })
    .onConflictDoUpdate({
      target: [sourceSnapshots.sourceId, sourceSnapshots.recordType, sourceSnapshots.recordId],
      set: { contentHash: hash, payload: safeJson(payload), retrievedAt: new Date().toISOString() },
    })
}

async function externalId(ctx: Context, entityType: string, entityId: string, value: string) {
  await ctx.db
    .insert(externalIds)
    .values({ entityType, entityId, source: 'tcgdex', externalId: value })
    .onConflictDoNothing()
}

/** Deterministic slug with collision fallback inside one game. */
function uniqueSlug(name: string, externalIdValue: string, taken: Map<string, string>): string {
  const base = slugify(name) || slugify(externalIdValue) || 'item'
  const owner = taken.get(base)
  if (!owner || owner === externalIdValue) {
    taken.set(base, externalIdValue)
    return base
  }
  const alt = `${base}-${slugify(externalIdValue)}`
  taken.set(alt, externalIdValue)
  return alt
}

// ───────────────────────────── series ─────────────────────────────

async function ingestSeries(ctx: Context, counters: IngestionCounters): Promise<Map<string, string>> {
  const existing = await ctx.db
    .select({ id: tcgSeries.id, externalId: tcgSeries.externalId, rawHash: tcgSeries.rawHash, slug: tcgSeries.slug })
    .from(tcgSeries)
    .where(eq(tcgSeries.gameId, ctx.gameId))
  const byExternal = new Map(existing.map((r) => [r.externalId, r]))
  const slugs = new Map(existing.map((r) => [r.slug, r.externalId]))
  const map = new Map<string, string>()

  const list = await ctx.adapter.listSeries()
  for (const series of list) {
    counters.seen += 1
    try {
      const hash = contentHash(series.raw)
      const current = byExternal.get(series.externalId)
      if (current && current.rawHash === hash) {
        counters.unchanged += 1
        map.set(series.externalId, current.id)
        continue
      }
      const values = {
        gameId: ctx.gameId,
        sourceId: ctx.sourceId,
        externalId: series.externalId,
        slug: current?.slug ?? uniqueSlug(series.name, series.externalId, slugs),
        name: series.name,
        releaseDate: series.releaseDate,
        logoUrl: series.logoUrl,
        rawHash: hash,
        updatedAt: new Date().toISOString(),
      }
      const [row] = await ctx.db
        .insert(tcgSeries)
        .values(values)
        .onConflictDoUpdate({ target: [tcgSeries.sourceId, tcgSeries.externalId], set: values })
        .returning({ id: tcgSeries.id })
      if (!row) throw new Error('upsert returned no row')
      map.set(series.externalId, row.id)
      await snapshot(ctx, 'series', series.externalId, hash, series.raw)
      await externalId(ctx, 'series', row.id, series.externalId)
      counters[current ? 'updated' : 'created'] += 1
    } catch (error) {
      counters.failed += 1
      await recordError(ctx, `series:${series.externalId}`, error, series.raw)
    }
  }
  return map
}

// ───────────────────────────── sets ─────────────────────────────

async function ingestSets(
  ctx: Context,
  seriesMap: Map<string, string>,
  counters: IngestionCounters,
  only?: string[],
): Promise<Map<string, { id: string; releaseDate: string | null }>> {
  const existing = await ctx.db
    .select({
      id: tcgSets.id,
      externalId: tcgSets.externalId,
      rawHash: tcgSets.rawHash,
      slug: tcgSets.slug,
      releaseDate: tcgSets.releaseDate,
    })
    .from(tcgSets)
    .where(eq(tcgSets.gameId, ctx.gameId))
  const byExternal = new Map(existing.map((r) => [r.externalId, r]))
  const slugs = new Map(existing.map((r) => [r.slug, r.externalId]))
  const map = new Map<string, { id: string; releaseDate: string | null }>()
  for (const row of existing) map.set(row.externalId, { id: row.id, releaseDate: row.releaseDate })

  let list = await ctx.adapter.listSets()
  if (only) list = list.filter((s) => only.includes(s.externalId))

  for (const set of list) {
    counters.seen += 1
    try {
      const seriesId = seriesMap.get(set.seriesExternalId)
      if (!seriesId) {
        throw new Error(`unknown series "${set.seriesExternalId}" for set ${set.externalId}`)
      }
      const hash = contentHash(set.raw)
      const current = byExternal.get(set.externalId)
      if (current && current.rawHash === hash) {
        counters.unchanged += 1
        continue
      }
      const values = {
        gameId: ctx.gameId,
        seriesId,
        sourceId: ctx.sourceId,
        externalId: set.externalId,
        slug: current?.slug ?? uniqueSlug(set.name, set.externalId, slugs),
        name: set.name,
        releaseDate: set.releaseDate,
        symbolUrl: set.symbolUrl,
        logoUrl: set.logoUrl,
        cardCountTotal: set.cardCountTotal,
        cardCountOfficial: set.cardCountOfficial,
        rawHash: hash,
        updatedAt: new Date().toISOString(),
      }
      const [row] = await ctx.db
        .insert(tcgSets)
        .values(values)
        .onConflictDoUpdate({ target: [tcgSets.sourceId, tcgSets.externalId], set: values })
        .returning({ id: tcgSets.id })
      if (!row) throw new Error('upsert returned no row')
      map.set(set.externalId, { id: row.id, releaseDate: set.releaseDate })
      await snapshot(ctx, 'set', set.externalId, hash, set.raw)
      await externalId(ctx, 'set', row.id, set.externalId)
      counters[current ? 'updated' : 'created'] += 1
    } catch (error) {
      counters.failed += 1
      await recordError(ctx, `set:${set.externalId}`, error, set.raw)
    }
  }
  return map
}

// ───────────────────────────── cards ─────────────────────────────

interface Caches {
  identities: Map<string, string>
  artists: Map<string, string>
  entities: Map<string, string>
  printings: Map<string, { id: string; rawHash: string }>
}

async function loadCaches(ctx: Context): Promise<Caches> {
  const [identityRows, artistRows, entityRows, printingRows] = await Promise.all([
    ctx.db
      .select({ id: cardIdentities.id, normalizedName: cardIdentities.normalizedName, entityType: cardIdentities.entityType })
      .from(cardIdentities)
      .where(eq(cardIdentities.gameId, ctx.gameId)),
    ctx.db.select({ id: artists.id, normalizedName: artists.normalizedName }).from(artists),
    ctx.db
      .select({ id: entities.id, kind: entities.kind, key: entities.key })
      .from(entities)
      .where(eq(entities.gameId, ctx.gameId)),
    ctx.db
      .select({
        id: cardPrintings.id,
        externalId: cardPrintings.externalId,
        language: cardPrintings.language,
        rawDataHash: cardPrintings.rawDataHash,
      })
      .from(cardPrintings)
      .where(eq(cardPrintings.sourceId, ctx.sourceId)),
  ])
  const printings = new Map<string, { id: string; rawHash: string }>()
  for (const r of printingRows) {
    printings.set(`${r.language}/${r.externalId}`, { id: r.id, rawHash: r.rawDataHash })
  }
  return {
    identities: new Map(identityRows.map((r) => [`${r.entityType}|${r.normalizedName}`, r.id])),
    artists: new Map(artistRows.map((r) => [r.normalizedName, r.id])),
    entities: new Map(entityRows.map((r) => [`${r.kind}:${r.key}`, r.id])),
    printings,
  }
}

async function ingestCards(
  ctx: Context,
  setMap: Map<string, { id: string; releaseDate: string | null }>,
  counters: IngestionCounters,
  options: IngestionOptions,
) {
  const caches = await loadCaches(ctx)
  const cards = await ctx.adapter.listCards({
    setExternalIds: options.setExternalIds,
    onProgress: options.onProgress,
  })

  // Process set by set inside a transaction: far fewer fsyncs on the embedded database.
  const bySet = new Map<string, typeof cards>()
  for (const card of cards) {
    const list = bySet.get(card.setExternalId) ?? []
    list.push(card)
    bySet.set(card.setExternalId, list)
  }

  for (const [setExternalId, setCards] of bySet) {
    const set = setMap.get(setExternalId)
    const pending: Array<{ recordId: string; error: unknown; payload: unknown }> = []
    await ctx.db.transaction(async (tx) => {
      const txCtx: Context = { ...ctx, db: tx as unknown as Db }
      for (const card of setCards) {
        counters.seen += 1
        const recordId = `card:${card.language}/${card.externalId}`
        try {
          if (!set) throw new Error(`unknown set "${setExternalId}" for card ${card.externalId}`)
          const outcome = await ingestCard(txCtx, caches, card, set)
          counters[outcome] += 1
        } catch (error) {
          counters.failed += 1
          pending.push({ recordId, error, payload: card.raw })
        }
      }
    })
    // Errors are written outside the transaction so a rollback can never lose them.
    for (const p of pending) await recordError(ctx, p.recordId, p.error, p.payload)
    ctx.log(`set ${setExternalId}: ${setCards.length} cards (${pending.length} failed)`)
  }
}

async function ingestCard(
  ctx: Context,
  caches: Caches,
  source: { externalId: string; setExternalId: string; language: string; raw: Record<string, unknown> },
  set: { id: string; releaseDate: string | null },
): Promise<'created' | 'updated' | 'unchanged'> {
  const normalized = validateNormalizedCard(ctx.adapter.normalizeCard(source))
  const key = `${normalized.language}/${normalized.externalId}`
  const current = caches.printings.get(key)
  if (current && current.rawHash === normalized.rawHash) return 'unchanged'

  const identityId = await resolveIdentityId(ctx, caches, normalized)
  const artistId = normalized.artistName ? await resolveArtistId(ctx, caches, normalized.artistName) : null

  const values = {
    identityId,
    setId: set.id,
    sourceId: ctx.sourceId,
    externalId: normalized.externalId,
    collectorNumber: normalized.collectorNumber,
    printedNumber: normalized.printedNumber,
    language: normalized.language,
    category: normalized.category,
    rarity: normalized.rarity,
    variant: normalized.variant,
    finish: normalized.finish,
    artistId,
    imageFront: normalized.imageFront,
    imageBack: normalized.imageBack,
    releaseDate: set.releaseDate,
    attributes: normalized.attributes,
    rawDataHash: normalized.rawHash,
    updatedAt: new Date().toISOString(),
  }
  const [row] = await ctx.db
    .insert(cardPrintings)
    .values(values)
    .onConflictDoUpdate({
      target: [cardPrintings.sourceId, cardPrintings.externalId, cardPrintings.language],
      set: values,
    })
    .returning({ id: cardPrintings.id })
  if (!row) throw new Error('printing upsert returned no row')
  caches.printings.set(key, { id: row.id, rawHash: normalized.rawHash })

  await ctx.db.delete(printingEntities).where(eq(printingEntities.printingId, row.id))
  for (const ref of normalized.entities) {
    const entityId = await resolveEntityId(ctx, caches, ref)
    await ctx.db
      .insert(printingEntities)
      .values({ printingId: row.id, entityId, relation: ref.relation, metadata: ref.metadata ?? {} })
      .onConflictDoNothing()
  }

  await externalId(ctx, 'card_printing', row.id, normalized.externalId)
  await snapshot(ctx, 'card', key, normalized.rawHash, source.raw)
  return current ? 'updated' : 'created'
}

async function resolveIdentityId(ctx: Context, caches: Caches, card: NormalizedCard): Promise<string> {
  const identity = ctx.adapter.resolveIdentity(card)
  const key = `${identity.entityType}|${identity.normalizedName}`
  const cached = caches.identities.get(key)
  if (cached) return cached
  const [inserted] = await ctx.db
    .insert(cardIdentities)
    .values({
      gameId: ctx.gameId,
      canonicalName: identity.canonicalName,
      normalizedName: identity.normalizedName,
      entityType: identity.entityType,
      description: identity.description,
    })
    .onConflictDoNothing()
    .returning({ id: cardIdentities.id })
  let id = inserted?.id
  if (!id) {
    const [existing] = await ctx.db
      .select({ id: cardIdentities.id })
      .from(cardIdentities)
      .where(
        and(
          eq(cardIdentities.gameId, ctx.gameId),
          eq(cardIdentities.normalizedName, identity.normalizedName),
          eq(cardIdentities.entityType, identity.entityType),
        ),
      )
    id = existing?.id
  }
  if (!id) throw new Error(`could not resolve identity for ${card.externalId}`)
  caches.identities.set(key, id)
  return id
}

async function resolveArtistId(ctx: Context, caches: Caches, name: string): Promise<string> {
  const normalized = normalizeName(name)
  const cached = caches.artists.get(normalized)
  if (cached) return cached
  const [inserted] = await ctx.db
    .insert(artists)
    .values({ name: name.trim(), normalizedName: normalized })
    .onConflictDoNothing()
    .returning({ id: artists.id })
  let id = inserted?.id
  if (!id) {
    const [existing] = await ctx.db
      .select({ id: artists.id })
      .from(artists)
      .where(eq(artists.normalizedName, normalized))
    id = existing?.id
  }
  if (!id) throw new Error(`could not resolve artist ${name}`)
  caches.artists.set(normalized, id)
  return id
}

async function resolveEntityId(
  ctx: Context,
  caches: Caches,
  ref: NormalizedCard['entities'][number],
): Promise<string> {
  const key = `${ref.kind}:${ref.key}`
  const cached = caches.entities.get(key)
  if (cached) return cached
  const [inserted] = await ctx.db
    .insert(entities)
    .values({
      gameId: ctx.gameId,
      kind: ref.kind,
      key: ref.key,
      name: ref.name,
      normalizedName: normalizeName(ref.name),
      metadata: ref.metadata ?? {},
    })
    .onConflictDoNothing()
    .returning({ id: entities.id })
  let id = inserted?.id
  if (!id) {
    const [existing] = await ctx.db
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.gameId, ctx.gameId), eq(entities.kind, ref.kind), eq(entities.key, ref.key)))
    id = existing?.id
  }
  if (!id) throw new Error(`could not resolve entity ${key}`)
  caches.entities.set(key, id)
  return id
}
