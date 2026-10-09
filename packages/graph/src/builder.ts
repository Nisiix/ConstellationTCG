/**
 * Graph projection builder (one shot).
 *
 * Reads the canonical catalog and (re)writes `graph_nodes` / `graph_edges` for a game in a single
 * transaction. The projection is derived data: it can be dropped and rebuilt at any time. Universal
 * edges (series → game, set → series, reprint → first printing, set similarity, counterparts in
 * earlier sets) are produced by the core; everything card-specific comes from the adapter's
 * `buildRelationships`.
 *
 * The same composition, split into bounded steps for serverless workers, lives in `incremental.ts`.
 */
import type { AdapterRegistry } from '@constellation/adapters'
import {
  artists,
  cardIdentities,
  cardPrintings,
  entities,
  eq,
  graphEdges,
  graphNodes,
  printingEntities,
  tcgGames,
  tcgSeries,
  tcgSets,
  type Database,
  type Db,
} from '@constellation/database'
import { makeNodeId, type EntityKind, type GraphEdge, type GraphNode, type NodeType, type TCGAdapter } from '@constellation/domain'
import {
  catalogRelationships,
  comparePrintings,
  composeArtistNode,
  composeEntityNode,
  composeGameNode,
  composeIdentityNode,
  composePrintingNode,
  composeSeriesNode,
  composeSetNode,
  EdgeCollector,
  identityNodeIdsByName,
  relationshipsForPrinting,
  releaseOf,
  reprintRelationships,
  searchTextFor,
  type GameRow,
  type PrintingRow,
  projectedEntityKinds,
  setPrintingIndex,
  stageOf,
} from './compose'
import { similarityRelationships, type SimilarityInput } from './similarity'

export { searchTextFor } from './compose'

export interface BuildOptions {
  database: Database
  registry: AdapterRegistry
  /** Only rebuild this game (slug). Default: every game with a registered adapter. */
  gameSlug?: string
  log?: (message: string) => void
}

export interface BuildReport {
  games: Array<{ slug: string; nodes: number; edges: number; skippedEdges: number }>
  durationMs: number
}

export const WRITE_CHUNK = 400

export async function buildGraphProjection(options: BuildOptions): Promise<BuildReport> {
  const started = Date.now()
  const log = options.log ?? (() => {})
  const db = options.database.db
  const games = await db
    .select()
    .from(tcgGames)
    .where(options.gameSlug ? eq(tcgGames.slug, options.gameSlug) : undefined)

  const report: BuildReport = { games: [], durationMs: 0 }
  for (const game of games) {
    const adapter = options.registry.bySlug(game.slug)
    if (!adapter) {
      log(`skip ${game.slug}: no adapter registered`)
      continue
    }
    log(`composing ${game.slug}`)
    const composed = await composeGame(db, game, adapter, log)
    log(`writing ${composed.nodes.length} nodes, ${composed.edges.length} edges`)
    await writeProjection(db, game.id, composed.nodes, composed.edges, crypto.randomUUID())
    report.games.push({
      slug: game.slug,
      nodes: composed.nodes.length,
      edges: composed.edges.length,
      skippedEdges: composed.skippedEdges,
    })
  }
  report.durationMs = Date.now() - started
  return report
}

interface Composed {
  nodes: GraphNode[]
  edges: GraphEdge[]
  skippedEdges: number
}

export async function composeGame(
  db: Db,
  game: GameRow,
  adapter: TCGAdapter,
  log: (message: string) => void = () => {},
): Promise<Composed> {
  const [seriesRows, setRows, identityRows, printingRows, artistRows, entityRows, linkRows] =
    await Promise.all([
      db.select().from(tcgSeries).where(eq(tcgSeries.gameId, game.id)),
      db.select().from(tcgSets).where(eq(tcgSets.gameId, game.id)),
      db.select().from(cardIdentities).where(eq(cardIdentities.gameId, game.id)),
      db
        .select({ printing: cardPrintings })
        .from(cardPrintings)
        .innerJoin(tcgSets, eq(cardPrintings.setId, tcgSets.id))
        .where(eq(tcgSets.gameId, game.id)),
      db.select().from(artists),
      db.select().from(entities).where(eq(entities.gameId, game.id)),
      db
        .select({ link: printingEntities })
        .from(printingEntities)
        .innerJoin(cardPrintings, eq(printingEntities.printingId, cardPrintings.id))
        .innerJoin(tcgSets, eq(cardPrintings.setId, tcgSets.id))
        .where(eq(tcgSets.gameId, game.id)),
    ])

  const printings = printingRows.map((r) => r.printing)
  const links = linkRows.map((r) => r.link)
  const placeholders = adapter.definition().placeholderImages ?? {}
  const setById = new Map(setRows.map((s) => [s.id, s]))
  const seriesById = new Map(seriesRows.map((s) => [s.id, s]))
  const artistById = new Map(artistRows.map((a) => [a.id, a]))
  const identityById = new Map(identityRows.map((i) => [i.id, i]))
  const order = (p: PrintingRow) => ({
    id: p.id,
    releaseDate: releaseOf(p, setById.get(p.setId)),
    collectorNumber: p.collectorNumber,
    externalId: p.externalId,
  })
  const earliest = (list: PrintingRow[]): PrintingRow | undefined => {
    let best: PrintingRow | undefined
    for (const p of list) if (!best || comparePrintings(order(p), order(best)) < 0) best = p
    return best
  }

  const nodes = new Map<string, GraphNode>()
  const addNode = (node: GraphNode) => nodes.set(node.id, node)

  // Game, series, sets.
  const gameNode = composeGameNode(game, { seriesCount: seriesRows.length, setCount: setRows.length }, placeholders)
  addNode(gameNode)
  const setsBySeries = new Map<string, number>()
  for (const set of setRows) setsBySeries.set(set.seriesId, (setsBySeries.get(set.seriesId) ?? 0) + 1)
  for (const series of seriesRows) addNode(composeSeriesNode(game.id, series, setsBySeries.get(series.id) ?? 0, placeholders))
  const printingsBySet = new Map<string, number>()
  for (const p of printings) printingsBySet.set(p.setId, (printingsBySet.get(p.setId) ?? 0) + 1)
  for (const set of setRows) addNode(composeSetNode(game.id, set, seriesById.get(set.seriesId), printingsBySet.get(set.id) ?? 0, placeholders))

  // Identities: count and first printing.
  const printingsByIdentity = new Map<string, PrintingRow[]>()
  for (const p of printings) {
    const list = printingsByIdentity.get(p.identityId) ?? []
    list.push(p)
    printingsByIdentity.set(p.identityId, list)
  }
  for (const identity of identityRows) {
    const owned = printingsByIdentity.get(identity.id) ?? []
    const first = earliest(owned)
    addNode(
      composeIdentityNode(
        game.id,
        identity,
        owned.length,
        first ? { releaseDate: releaseOf(first, setById.get(first.setId)), imageFront: first.imageFront } : null,
      ),
    )
  }

  // Artists: illustration count and the earliest illustration with an image.
  const printingsByArtist = new Map<string, PrintingRow[]>()
  for (const p of printings) {
    if (!p.artistId) continue
    const list = printingsByArtist.get(p.artistId) ?? []
    list.push(p)
    printingsByArtist.set(p.artistId, list)
  }
  for (const artist of artistRows) {
    const list = printingsByArtist.get(artist.id)
    if (!list) continue
    const representative = earliest(list.filter((p) => p.imageFront))
    addNode(composeArtistNode(game.id, artist, list.length, representative?.imageFront ?? null))
  }

  // Entities: every link counts; species get the earliest card that shows them.
  const printingById = new Map(printings.map((p) => [p.id, p]))
  const linksByEntity = new Map<string, number>()
  const speciesPrintings = new Map<string, PrintingRow[]>()
  for (const link of links) {
    linksByEntity.set(link.entityId, (linksByEntity.get(link.entityId) ?? 0) + 1)
    if (link.relation === 'SAME_POKEMON') {
      const p = printingById.get(link.printingId)
      if (p?.imageFront) {
        const list = speciesPrintings.get(link.entityId) ?? []
        list.push(p)
        speciesPrintings.set(link.entityId, list)
      }
    }
  }
  const entityNodeIdByKey = new Map<string, string>()
  const entityNodeIds = new Map<string, string>()
  const kinds = projectedEntityKinds(adapter)
  for (const entity of entityRows) {
    const count = linksByEntity.get(entity.id) ?? 0
    // An entity no card refers to any more (e.g. attacks from an older ingestion) is not a point,
    // and neither is a kind the adapter keeps as card data (energy types, attacks).
    if (count === 0 || !kinds.has(entity.kind)) continue
    const node = composeEntityNode(game.id, entity, count, earliest(speciesPrintings.get(entity.id) ?? [])?.imageFront ?? null)
    addNode(node)
    entityNodeIds.set(entity.id, node.id)
    entityNodeIdByKey.set(`${entity.kind}:${entity.key}`, node.id)
  }

  // Printings.
  for (const p of printings) {
    addNode(
      composePrintingNode(
        game.id,
        p,
        setById.get(p.setId),
        p.artistId ? artistById.get(p.artistId) : undefined,
        identityById.get(p.identityId),
      ),
    )
  }

  // Edges.
  const collector = new EdgeCollector((id) => nodes.has(id))
  collector.addAll(catalogRelationships(gameNode.id, seriesRows, setRows))

  const byName = identityNodeIdsByName(identityRows)
  const entityById = new Map(entityRows.map((e) => [e.id, e]))
  const inSet = setPrintingIndex(printings, (id) => identityById.get(id)?.normalizedName)
  const linksByPrinting = new Map<string, typeof links>()
  for (const link of links) {
    const list = linksByPrinting.get(link.printingId) ?? []
    list.push(link)
    linksByPrinting.set(link.printingId, list)
  }
  let skippedPrintings = 0
  for (const p of printings) {
    const identity = identityById.get(p.identityId)
    const set = setById.get(p.setId)
    if (!identity || !set || !seriesById.has(set.seriesId)) {
      skippedPrintings += 1
      continue
    }
    collector.addAll(
      relationshipsForPrinting(adapter, {
        gameNodeId: gameNode.id,
        printing: p,
        identity,
        artistNodeId: p.artistId && artistById.has(p.artistId) ? makeNodeId('artist', p.artistId) : null,
        links: (linksByPrinting.get(p.id) ?? []).flatMap((link) => {
          const entity = entityById.get(link.entityId)
          const entityNodeId = entityNodeIds.get(link.entityId)
          if (!entity || !entityNodeId) return []
          return [{ kind: entity.kind as EntityKind, key: entity.key, relation: link.relation, entityNodeId, metadata: link.metadata as Record<string, unknown> }]
        }),
        identityNodeIdByName: (name) => byName.get(name) ?? null,
        entityNodeIdByKey: (kind, key) => entityNodeIdByKey.get(`${kind}:${key}`) ?? null,
        setPrintingNodeIdsByName: (name) => inSet.get(p.setId)?.get(name) ?? [],
      }),
    )
  }
  for (const list of printingsByIdentity.values()) collector.addAll(reprintRelationships(list.map(order)))
  collector.addAll(similarityRelationships(similarityInput(adapter, setRows, printings, links)))

  const skipped = collector.skipped + skippedPrintings
  if (skipped > 0) log(`${skipped} edges skipped (missing endpoint)`)
  return { nodes: [...nodes.values()], edges: collector.list(), skippedEdges: skipped }
}

/** What set similarity and counterparts are computed from, read from the rows in memory. */
export function similarityInput(
  adapter: TCGAdapter,
  setRows: Array<{ id: string; externalId: string; releaseDate: string | null }>,
  printings: PrintingRow[],
  links: Array<{ printingId: string; entityId: string; relation: string }>,
): SimilarityInput {
  const subjectRelation = adapter.definition().subjectRelation
  return {
    sets: setRows.map((s) => ({ id: s.id, externalId: s.externalId, releaseDate: s.releaseDate })),
    printings: printings.map((p) => ({
      id: p.id,
      setId: p.setId,
      identityId: p.identityId,
      artistId: p.artistId,
      category: p.category,
      rarity: p.rarity,
      stage: stageOf(p.attributes),
      collectorNumber: p.collectorNumber,
      externalId: p.externalId,
      releaseDate: p.releaseDate,
    })),
    subjects: subjectRelation
      ? links.filter((l) => l.relation === subjectRelation).map((l) => ({ printingId: l.printingId, subjectId: l.entityId }))
      : printings.map((p) => ({ printingId: p.id, subjectId: p.identityId })),
  }
}

/** Replace a game's projection in one transaction. `buildId` marks every row of this build. */
export async function writeProjection(db: Db, gameId: string, nodes: GraphNode[], edges: GraphEdge[], buildId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(graphNodes).where(eq(graphNodes.gameId, gameId))
    const now = new Date().toISOString()
    for (let i = 0; i < nodes.length; i += WRITE_CHUNK) {
      await tx.insert(graphNodes).values(nodes.slice(i, i + WRITE_CHUNK).map((n) => nodeRow(n, buildId, now)))
    }
    for (let i = 0; i < edges.length; i += WRITE_CHUNK) {
      await tx.insert(graphEdges).values(edges.slice(i, i + WRITE_CHUNK).map((e) => edgeRow(e, buildId, now)))
    }
  })
}

export function nodeRow(n: GraphNode, buildId: string, now: string): typeof graphNodes.$inferInsert {
  return {
    id: n.id,
    gameId: n.gameId,
    nodeType: n.nodeType as NodeType,
    entityId: n.entityId,
    label: n.label,
    subtitle: n.subtitle,
    imageUrl: n.imageUrl,
    searchText: searchTextFor(n),
    metadata: n.metadata,
    buildId,
    createdAt: now,
    updatedAt: now,
  }
}

export function edgeRow(e: GraphEdge, buildId: string, now: string): typeof graphEdges.$inferInsert {
  return {
    id: e.id,
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
    relationshipType: e.relationshipType,
    weight: e.weight,
    direction: e.direction,
    metadata: e.metadata,
    buildId,
    createdAt: now,
  }
}
