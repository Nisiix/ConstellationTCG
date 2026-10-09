/**
 * Graph projection builder, resumable.
 *
 * The same projection as `buildGraphProjection`, produced in bounded steps that each read a slice
 * of the catalog, compose it with the helpers in `compose.ts` and upsert the result:
 *
 *   scaffold            game, series, sets, artists, entities (+ series → game, set → series)
 *   identities (pages)  identity nodes with printing count and first printing
 *   printings (per set) printing nodes and the adapter's relationships for that set's cards
 *   reprints (pages)    REPRINT_OF edges, identities in pages
 *   similarity          set ↔ set similarity and counterparts in earlier sets (one pass, aggregates)
 *   finish              deletes the rows of the game that this build did not write
 *
 * Every step fits a serverless worker (a Supabase Edge Function has 2 s of CPU per request); the
 * one-shot builder needs about 3 s for a full catalog just to compose. Rows carry the `buildId`, so
 * a build that stops halfway leaves a consistent (older) projection in place and the next build
 * carries on; the one-shot path is used by the CLI and the tests.
 */
import {
  artists,
  cardIdentities,
  cardPrintings,
  count,
  entities,
  eq,
  graphEdges,
  graphNodes,
  inArray,
  sql,
  tcgGames,
  tcgSeries,
  tcgSets,
  type Database,
  type Db,
} from '@constellation/database'
import { makeNodeId, type EntityKind, type GraphEdge, type GraphNode, type TCGAdapter } from '@constellation/domain'
import { edgeRow, nodeRow, WRITE_CHUNK } from './builder'
import {
  catalogRelationships,
  composeArtistNode,
  composeEntityNode,
  composeGameNode,
  composeIdentityNode,
  composePrintingNode,
  composeSeriesNode,
  composeSetNode,
  EdgeCollector,
  identityNodeIdsByName,
  PRINTING_ORDER_SQL,
  projectedEntityKinds,
  relationshipsForPrinting,
  releaseOf,
  reprintRelationships,
  setPrintingIndex,
  type PrintingRow,
} from './compose'
import { rows } from './rows'
import { similarityRelationships, type SimilarityInput } from './similarity'

export type GraphStep =
  | { kind: 'scaffold' }
  | { kind: 'identities'; page: number; pageSize: number }
  | { kind: 'printings'; setId: string }
  | { kind: 'reprints'; page: number; pageSize: number }
  | { kind: 'similarity' }
  | { kind: 'finish' }

export interface GraphStepReport {
  step: GraphStep
  nodes: number
  edges: number
  skippedEdges: number
  deletedNodes: number
  deletedEdges: number
}

export interface GraphStepOptions {
  database: Database
  adapter: TCGAdapter
  gameId: string
  /** Identifies this build; `finish` deletes every row of the game written by another build. */
  buildId: string
  step: GraphStep
  log?: (message: string) => void
}

export const DEFAULT_IDENTITY_PAGE = 2000
export const DEFAULT_REPRINT_PAGE = 4000

/** Describe a step for logs and job payloads. */
export function describeGraphStep(step: GraphStep): string {
  switch (step.kind) {
    case 'scaffold':
      return 'scaffold'
    case 'identities':
      return `identities page ${step.page}`
    case 'printings':
      return `printings of set ${step.setId}`
    case 'reprints':
      return `reprints page ${step.page}`
    case 'similarity':
      return 'set similarity and counterparts'
    case 'finish':
      return 'finish'
  }
}

/**
 * The steps that follow the scaffold for a game, in the order they must run: identity pages, one
 * printings step per set, reprint pages, similarity, finish. Sets come oldest first so the sky grows in time
 * order while a build is in progress.
 */
export async function planGraphBuild(
  db: Db,
  gameId: string,
  options: { identityPageSize?: number; reprintPageSize?: number } = {},
): Promise<GraphStep[]> {
  const identityPage = options.identityPageSize ?? DEFAULT_IDENTITY_PAGE
  const reprintPage = options.reprintPageSize ?? DEFAULT_REPRINT_PAGE
  const [identityCount] = await db.select({ n: count() }).from(cardIdentities).where(eq(cardIdentities.gameId, gameId))
  const identities = Number(identityCount?.n ?? 0)
  const sets = await db
    .select({ id: tcgSets.id })
    .from(tcgSets)
    .where(eq(tcgSets.gameId, gameId))
    .orderBy(sql`${tcgSets.releaseDate} nulls last`, tcgSets.externalId)
  const steps: GraphStep[] = []
  for (let page = 0; page * identityPage < identities; page += 1) steps.push({ kind: 'identities', page, pageSize: identityPage })
  for (const set of sets) steps.push({ kind: 'printings', setId: set.id })
  for (let page = 0; page * reprintPage < identities; page += 1) steps.push({ kind: 'reprints', page, pageSize: reprintPage })
  steps.push({ kind: 'similarity' })
  steps.push({ kind: 'finish' })
  return steps
}

export async function runGraphStep(options: GraphStepOptions): Promise<GraphStepReport> {
  const { step } = options
  const log = options.log ?? (() => {})
  const report: GraphStepReport = { step, nodes: 0, edges: 0, skippedEdges: 0, deletedNodes: 0, deletedEdges: 0 }
  const db = options.database.db
  switch (step.kind) {
    case 'scaffold':
      await scaffold(db, options, report)
      break
    case 'identities':
      await identityPage(db, options, step, report)
      break
    case 'printings':
      await printingsOfSet(db, options, step, report)
      break
    case 'reprints':
      await reprintPage(db, options, step, report)
      break
    case 'similarity':
      await similarity(db, options, report)
      break
    case 'finish':
      await finish(db, options, report)
      break
  }
  log(
    `graph ${describeGraphStep(step)}: ${report.nodes} nodes, ${report.edges} edges` +
      (report.skippedEdges ? `, ${report.skippedEdges} skipped` : '') +
      (step.kind === 'finish' ? `, removed ${report.deletedNodes} nodes and ${report.deletedEdges} edges` : ''),
  )
  return report
}

// ───────────────────────────── steps ─────────────────────────────

async function scaffold(db: Db, options: GraphStepOptions, report: GraphStepReport) {
  const { gameId, adapter } = options
  const [game] = await db.select().from(tcgGames).where(eq(tcgGames.id, gameId))
  if (!game) throw new Error(`game ${gameId} not found`)
  const placeholders = adapter.definition().placeholderImages ?? {}
  const seriesRows = await db.select().from(tcgSeries).where(eq(tcgSeries.gameId, gameId))
  const setRows = await db.select().from(tcgSets).where(eq(tcgSets.gameId, gameId))
  const seriesById = new Map(seriesRows.map((s) => [s.id, s]))

  const printingCounts = new Map(
    rows<{ set_id: string; n: number | string }>(
      await db.execute(sql`
        select p.set_id, count(*)::int as n from card_printings p
        join tcg_sets s on s.id = p.set_id where s.game_id = ${gameId} group by p.set_id`),
    ).map((r) => [r.set_id, Number(r.n)]),
  )
  const artistCounts = new Map(
    rows<{ artist_id: string; n: number | string }>(
      await db.execute(sql`
        select p.artist_id, count(*)::int as n from card_printings p
        join tcg_sets s on s.id = p.set_id where s.game_id = ${gameId} and p.artist_id is not null group by p.artist_id`),
    ).map((r) => [r.artist_id, Number(r.n)]),
  )
  const artistImages = new Map(
    rows<{ artist_id: string; image_front: string }>(
      await db.execute(sql`
        select distinct on (p.artist_id) p.artist_id, p.image_front from card_printings p
        join tcg_sets s on s.id = p.set_id
        where s.game_id = ${gameId} and p.artist_id is not null and p.image_front is not null
        order by p.artist_id, ${sql.raw(PRINTING_ORDER_SQL)}`),
    ).map((r) => [r.artist_id, r.image_front]),
  )
  const entityCounts = new Map(
    rows<{ entity_id: string; n: number | string }>(
      await db.execute(sql`
        select pe.entity_id, count(*)::int as n from printing_entities pe
        join card_printings p on p.id = pe.printing_id join tcg_sets s on s.id = p.set_id
        where s.game_id = ${gameId} group by pe.entity_id`),
    ).map((r) => [r.entity_id, Number(r.n)]),
  )
  const speciesImages = new Map(
    rows<{ entity_id: string; image_front: string }>(
      await db.execute(sql`
        select distinct on (pe.entity_id) pe.entity_id, p.image_front from printing_entities pe
        join card_printings p on p.id = pe.printing_id join tcg_sets s on s.id = p.set_id
        where s.game_id = ${gameId} and pe.relation = 'SAME_POKEMON' and p.image_front is not null
        order by pe.entity_id, ${sql.raw(PRINTING_ORDER_SQL)}`),
    ).map((r) => [r.entity_id, r.image_front]),
  )
  const artistIds = [...artistCounts.keys()]
  const artistRows = artistIds.length ? await db.select().from(artists).where(inArray(artists.id, artistIds)) : []
  const entityRows = await db.select().from(entities).where(eq(entities.gameId, gameId))

  const nodes: GraphNode[] = []
  const gameNode = composeGameNode(game, { seriesCount: seriesRows.length, setCount: setRows.length }, placeholders)
  nodes.push(gameNode)
  const setsBySeries = new Map<string, number>()
  for (const set of setRows) setsBySeries.set(set.seriesId, (setsBySeries.get(set.seriesId) ?? 0) + 1)
  for (const series of seriesRows) nodes.push(composeSeriesNode(gameId, series, setsBySeries.get(series.id) ?? 0, placeholders))
  for (const set of setRows) nodes.push(composeSetNode(gameId, set, seriesById.get(set.seriesId), printingCounts.get(set.id) ?? 0, placeholders))
  for (const artist of artistRows) nodes.push(composeArtistNode(gameId, artist, artistCounts.get(artist.id) ?? 0, artistImages.get(artist.id) ?? null))
  const kinds = projectedEntityKinds(adapter)
  for (const entity of entityRows) {
    const n = entityCounts.get(entity.id) ?? 0
    if (n === 0 || !kinds.has(entity.kind)) continue
    nodes.push(composeEntityNode(gameId, entity, n, speciesImages.get(entity.id) ?? null))
  }
  const known = new Set(nodes.map((n) => n.id))
  const collector = new EdgeCollector((id) => known.has(id))
  collector.addAll(catalogRelationships(gameNode.id, seriesRows, setRows))

  await upsertNodes(db, nodes, options.buildId)
  await upsertEdges(db, collector.list(), options.buildId)
  report.nodes = nodes.length
  report.edges = collector.edges.size
  report.skippedEdges = collector.skipped
}

async function identityPage(db: Db, options: GraphStepOptions, step: { page: number; pageSize: number }, report: GraphStepReport) {
  const { gameId } = options
  const identityRows = await db
    .select()
    .from(cardIdentities)
    .where(eq(cardIdentities.gameId, gameId))
    .orderBy(cardIdentities.id)
    .limit(step.pageSize)
    .offset(step.page * step.pageSize)
  if (identityRows.length === 0) return
  const ids = identityRows.map((i) => i.id)
  const counts = new Map(
    (
      await db
        .select({ identityId: cardPrintings.identityId, n: count() })
        .from(cardPrintings)
        .where(inArray(cardPrintings.identityId, ids))
        .groupBy(cardPrintings.identityId)
    ).map((r) => [r.identityId, Number(r.n)]),
  )
  const firsts = new Map(
    rows<{ identity_id: string; release_date: string | null; image_front: string | null }>(
      await db.execute(sql`
        select distinct on (p.identity_id) p.identity_id,
          coalesce(p.release_date::text, s.release_date::text) as release_date, p.image_front
        from card_printings p join tcg_sets s on s.id = p.set_id
        where p.identity_id in ${ids}
        order by p.identity_id, ${sql.raw(PRINTING_ORDER_SQL)}`),
    ).map((r) => [r.identity_id, r]),
  )
  const nodes = identityRows.map((identity) => {
    const first = firsts.get(identity.id)
    return composeIdentityNode(
      gameId,
      identity,
      counts.get(identity.id) ?? 0,
      first ? { releaseDate: first.release_date, imageFront: first.image_front } : null,
    )
  })
  await upsertNodes(db, nodes, options.buildId)
  report.nodes = nodes.length
}

async function printingsOfSet(db: Db, options: GraphStepOptions, step: { setId: string }, report: GraphStepReport) {
  const { gameId, adapter } = options
  const [set] = await db.select().from(tcgSets).where(eq(tcgSets.id, step.setId))
  if (!set || set.gameId !== gameId) throw new Error(`set ${step.setId} not found in game ${gameId}`)
  const [series] = await db.select().from(tcgSeries).where(eq(tcgSeries.id, set.seriesId))
  const printings = await db.select().from(cardPrintings).where(eq(cardPrintings.setId, set.id))
  if (printings.length === 0) return

  const identityIds = [...new Set(printings.map((p) => p.identityId))]
  const identityRows = await db.select().from(cardIdentities).where(inArray(cardIdentities.id, identityIds))
  const identityById = new Map(identityRows.map((i) => [i.id, i]))
  const artistIds = [...new Set(printings.map((p) => p.artistId).filter((id): id is string => Boolean(id)))]
  const artistRows = artistIds.length ? await db.select().from(artists).where(inArray(artists.id, artistIds)) : []
  const artistById = new Map(artistRows.map((a) => [a.id, a]))
  const links = rows<{ printing_id: string; entity_id: string; relation: string; metadata: Record<string, unknown> | string | null }>(
    await db.execute(sql`
      select pe.printing_id, pe.entity_id, pe.relation, pe.metadata from printing_entities pe
      join card_printings p on p.id = pe.printing_id where p.set_id = ${set.id}`),
  )

  // Lookups across the whole game: every node an edge of this set may point at.
  const identityIndex = rows<{ id: string; normalized_name: string; entity_type: string }>(
    await db.execute(sql`select id, normalized_name, entity_type from card_identities where game_id = ${gameId}`),
  ).map((r) => ({ id: r.id, normalizedName: r.normalized_name, entityType: r.entity_type }))
  const byName = identityNodeIdsByName(identityIndex)
  const linkedEntities = rows<{ id: string; kind: string; key: string }>(
    await db.execute(sql`
      select e.id, e.kind, e.key from entities e
      where e.game_id = ${gameId} and exists (select 1 from printing_entities pe where pe.entity_id = e.id)`),
  )
  const entityById = new Map(linkedEntities.map((e) => [e.id, e]))
  const entityNodeIdByKey = new Map(linkedEntities.map((e) => [`${e.kind}:${e.key}`, makeNodeId(e.kind as EntityKind, e.id)]))
  const usedArtists = rows<{ artist_id: string }>(
    await db.execute(sql`
      select distinct p.artist_id from card_printings p join tcg_sets s on s.id = p.set_id
      where s.game_id = ${gameId} and p.artist_id is not null`),
  )
  const allSets = await db.select({ id: tcgSets.id, seriesId: tcgSets.seriesId }).from(tcgSets).where(eq(tcgSets.gameId, gameId))

  const known = new Set<string>([makeNodeId('game', gameId)])
  for (const s of allSets) {
    known.add(makeNodeId('set', s.id))
    known.add(makeNodeId('series', s.seriesId))
  }
  for (const i of identityIndex) known.add(makeNodeId('card_identity', i.id))
  for (const a of usedArtists) known.add(makeNodeId('artist', a.artist_id))
  const kinds = projectedEntityKinds(adapter)
  for (const e of linkedEntities) if (kinds.has(e.kind)) known.add(makeNodeId(e.kind as EntityKind, e.id))
  for (const p of printings) known.add(makeNodeId('card_printing', p.id))
  const inSet = setPrintingIndex(printings, (id) => identityById.get(id)?.normalizedName)

  const linksByPrinting = new Map<string, typeof links>()
  for (const link of links) {
    const list = linksByPrinting.get(link.printing_id) ?? []
    list.push(link)
    linksByPrinting.set(link.printing_id, list)
  }

  const nodes: GraphNode[] = []
  const collector = new EdgeCollector((id) => known.has(id))
  let skippedPrintings = 0
  for (const p of printings) {
    const identity = identityById.get(p.identityId)
    nodes.push(composePrintingNode(gameId, p, set, p.artistId ? artistById.get(p.artistId) : undefined, identity))
    if (!identity || !series) {
      skippedPrintings += 1
      continue
    }
    collector.addAll(
      relationshipsForPrinting(adapter, {
        gameNodeId: makeNodeId('game', gameId),
        printing: p as PrintingRow,
        identity,
        artistNodeId: p.artistId ? makeNodeId('artist', p.artistId) : null,
        links: (linksByPrinting.get(p.id) ?? []).flatMap((link) => {
          const entity = entityById.get(link.entity_id)
          if (!entity) return []
          return [
            {
              kind: entity.kind as EntityKind,
              key: entity.key,
              relation: link.relation,
              entityNodeId: makeNodeId(entity.kind as EntityKind, entity.id),
              metadata: parseJson(link.metadata),
            },
          ]
        }),
        identityNodeIdByName: (name) => byName.get(name) ?? null,
        entityNodeIdByKey: (kind, key) => entityNodeIdByKey.get(`${kind}:${key}`) ?? null,
        setPrintingNodeIdsByName: (name) => inSet.get(p.setId)?.get(name) ?? [],
      }),
    )
  }
  await upsertNodes(db, nodes, options.buildId)
  await upsertEdges(db, collector.list(), options.buildId)
  report.nodes = nodes.length
  report.edges = collector.edges.size
  report.skippedEdges = collector.skipped + skippedPrintings
}

async function reprintPage(db: Db, options: GraphStepOptions, step: { page: number; pageSize: number }, report: GraphStepReport) {
  const { gameId } = options
  const idRows = await db
    .select({ id: cardIdentities.id })
    .from(cardIdentities)
    .where(eq(cardIdentities.gameId, gameId))
    .orderBy(cardIdentities.id)
    .limit(step.pageSize)
    .offset(step.page * step.pageSize)
  if (idRows.length === 0) return
  const ids = idRows.map((r) => r.id)
  const printings = rows<{ id: string; identity_id: string; release_date: string | null; collector_number: string; external_id: string }>(
    await db.execute(sql`
      select p.id, p.identity_id, coalesce(p.release_date::text, s.release_date::text) as release_date,
        p.collector_number, p.external_id
      from card_printings p join tcg_sets s on s.id = p.set_id
      where p.identity_id in ${ids}`),
  )
  const byIdentity = new Map<string, typeof printings>()
  for (const p of printings) {
    const list = byIdentity.get(p.identity_id) ?? []
    list.push(p)
    byIdentity.set(p.identity_id, list)
  }
  const collector = new EdgeCollector(() => true)
  for (const list of byIdentity.values()) {
    collector.addAll(
      reprintRelationships(
        list.map((p) => ({ id: p.id, releaseDate: p.release_date, collectorNumber: p.collector_number, externalId: p.external_id })),
      ),
    )
  }
  await upsertEdges(db, collector.list(), options.buildId)
  report.edges = collector.edges.size
}

/**
 * Set similarity and counterparts need the whole catalog, but only a few narrow columns of it: the
 * sets, one row per printing and its subject links. The composition is the same as the one-shot
 * builder's (`similarityRelationships`).
 */
async function similarity(db: Db, options: GraphStepOptions, report: GraphStepReport) {
  const { gameId, adapter } = options
  const subjectRelation = adapter.definition().subjectRelation
  const sets = await db
    .select({ id: tcgSets.id, externalId: tcgSets.externalId, releaseDate: tcgSets.releaseDate })
    .from(tcgSets)
    .where(eq(tcgSets.gameId, gameId))
  const printings = rows<{
    id: string
    set_id: string
    identity_id: string
    artist_id: string | null
    category: string | null
    rarity: string | null
    stage: string | null
    collector_number: string
    external_id: string
    release_date: string | null
  }>(
    await db.execute(sql`
      select p.id, p.set_id, p.identity_id, p.artist_id, p.category, p.rarity,
        case when jsonb_typeof(p.attributes->'stage') = 'string' and p.attributes->>'stage' <> '' then p.attributes->>'stage' end as stage,
        p.collector_number, p.external_id, p.release_date::text as release_date
      from card_printings p join tcg_sets s on s.id = p.set_id where s.game_id = ${gameId}`),
  )
  const subjects = subjectRelation
    ? rows<{ printing_id: string; entity_id: string }>(
        await db.execute(sql`
          select pe.printing_id, pe.entity_id from printing_entities pe
          join card_printings p on p.id = pe.printing_id join tcg_sets s on s.id = p.set_id
          where s.game_id = ${gameId} and pe.relation = ${subjectRelation}`),
      ).map((r) => ({ printingId: r.printing_id, subjectId: r.entity_id }))
    : printings.map((p) => ({ printingId: p.id, subjectId: p.identity_id }))
  const input: SimilarityInput = {
    sets,
    printings: printings.map((p) => ({
      id: p.id,
      setId: p.set_id,
      identityId: p.identity_id,
      artistId: p.artist_id,
      category: p.category,
      rarity: p.rarity,
      stage: p.stage,
      collectorNumber: p.collector_number,
      externalId: p.external_id,
      releaseDate: p.release_date,
    })),
    subjects,
  }
  const collector = new EdgeCollector(() => true)
  collector.addAll(similarityRelationships(input))
  await upsertEdges(db, collector.list(), options.buildId)
  report.edges = collector.edges.size
}

async function finish(db: Db, options: GraphStepOptions, report: GraphStepReport) {
  const { gameId, buildId } = options
  report.deletedEdges = affected(
    await db.execute(sql`
      delete from graph_edges e using graph_nodes n
      where n.id = e.source_node_id and n.game_id = ${gameId} and e.build_id is distinct from ${buildId}`),
  )
  report.deletedNodes = affected(
    await db.execute(sql`delete from graph_nodes where game_id = ${gameId} and build_id is distinct from ${buildId}`),
  )
}

// ───────────────────────────── writes ─────────────────────────────

async function upsertNodes(db: Db, nodes: GraphNode[], buildId: string) {
  const now = new Date().toISOString()
  for (let i = 0; i < nodes.length; i += WRITE_CHUNK) {
    await db
      .insert(graphNodes)
      .values(nodes.slice(i, i + WRITE_CHUNK).map((n) => nodeRow(n, buildId, now)))
      .onConflictDoUpdate({
        target: graphNodes.id,
        set: {
          gameId: sql`excluded.game_id`,
          nodeType: sql`excluded.node_type`,
          entityId: sql`excluded.entity_id`,
          label: sql`excluded.label`,
          subtitle: sql`excluded.subtitle`,
          imageUrl: sql`excluded.image_url`,
          searchText: sql`excluded.search_text`,
          metadata: sql`excluded.metadata`,
          buildId: sql`excluded.build_id`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
  }
}

async function upsertEdges(db: Db, edges: GraphEdge[], buildId: string) {
  const now = new Date().toISOString()
  for (let i = 0; i < edges.length; i += WRITE_CHUNK) {
    await db
      .insert(graphEdges)
      .values(edges.slice(i, i + WRITE_CHUNK).map((e) => edgeRow(e, buildId, now)))
      .onConflictDoUpdate({
        target: graphEdges.id,
        set: {
          weight: sql`excluded.weight`,
          direction: sql`excluded.direction`,
          metadata: sql`excluded.metadata`,
          buildId: sql`excluded.build_id`,
        },
      })
  }
}

/** Rows affected by a statement, whatever the driver returns. */
function affected(result: unknown): number {
  if (Array.isArray(result)) return Number((result as unknown as { count?: number }).count ?? result.length)
  if (result && typeof result === 'object') {
    const r = result as { affectedRows?: number; rowCount?: number; count?: number }
    return Number(r.affectedRows ?? r.rowCount ?? r.count ?? 0)
  }
  return 0
}

function parseJson(value: Record<string, unknown> | string | null): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return value
}

/** The build id of a game's current projection, if it was written in one piece. */
export async function currentBuildId(db: Db, gameId: string): Promise<string | null> {
  const [row] = rows<{ build_id: string | null }>(
    await db.execute(sql`select build_id from graph_nodes where game_id = ${gameId} order by updated_at desc limit 1`),
  )
  return row?.build_id ?? null
}
