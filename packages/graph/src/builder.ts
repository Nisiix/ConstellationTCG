/**
 * Graph projection builder.
 *
 * Reads the canonical catalog and (re)writes `graph_nodes` / `graph_edges` for a game. The
 * projection is derived data: it can be dropped and rebuilt at any time. Universal edges
 * (series → game, set → series) are produced here; everything card-specific comes from the
 * adapter's `buildRelationships`.
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
import {
  GraphError,
  makeEdgeId,
  makeNodeId,
  normalizeName,
  type EntityKind,
  type GraphEdge,
  type GraphNode,
  type NodeType,
  type RelationshipContext,
  type TCGAdapter,
} from '@constellation/domain'

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

const CHUNK = 400

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
    await writeProjection(db, game.id, composed.nodes, composed.edges)
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

type GameRow = typeof tcgGames.$inferSelect

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

  // Sets and series without an image of their own show the game's standard image instead
  // (Pokémon: the classic Base Set logo). `imagePlaceholder` tells the UI it is a stand-in.
  const placeholders = adapter.definition().placeholderImages ?? {}
  const pickImage = (own: string | null | undefined, type: NodeType): { imageUrl: string | null; imagePlaceholder: boolean } => {
    if (own) return { imageUrl: own, imagePlaceholder: false }
    const fallback = placeholders[type]
    return fallback ? { imageUrl: fallback, imagePlaceholder: true } : { imageUrl: null, imagePlaceholder: false }
  }

  const nodes = new Map<string, GraphNode>()
  const addNode = (node: GraphNode) => nodes.set(node.id, node)

  const gameNodeId = makeNodeId('game', game.id)
  const gameImage = pickImage(null, 'game')
  addNode({
    id: gameNodeId,
    gameId: game.id,
    nodeType: 'game',
    entityId: game.id,
    label: game.name,
    subtitle: game.publisher,
    imageUrl: gameImage.imageUrl,
    metadata: {
      slug: game.slug,
      seriesCount: seriesRows.length,
      setCount: setRows.length,
      imagePlaceholder: gameImage.imagePlaceholder,
    },
  })

  const setsBySeries = new Map<string, typeof setRows>()
  for (const set of setRows) {
    const list = setsBySeries.get(set.seriesId) ?? []
    list.push(set)
    setsBySeries.set(set.seriesId, list)
  }
  const seriesById = new Map(seriesRows.map((s) => [s.id, s]))
  const seriesNodeIds = new Map<string, string>()
  for (const series of seriesRows) {
    const id = makeNodeId('series', series.id)
    seriesNodeIds.set(series.id, id)
    const count = setsBySeries.get(series.id)?.length ?? 0
    const image = pickImage(series.logoUrl, 'series')
    addNode({
      id,
      gameId: game.id,
      nodeType: 'series',
      entityId: series.id,
      label: series.name,
      subtitle: `${count} ${count === 1 ? 'set' : 'sets'}`,
      imageUrl: image.imageUrl,
      metadata: {
        slug: series.slug,
        releaseDate: series.releaseDate,
        setCount: count,
        imagePlaceholder: image.imagePlaceholder,
      },
    })
  }

  const printingsBySet = new Map<string, number>()
  for (const p of printings) printingsBySet.set(p.setId, (printingsBySet.get(p.setId) ?? 0) + 1)
  const setById = new Map(setRows.map((s) => [s.id, s]))
  const setNodeIds = new Map<string, string>()
  for (const set of setRows) {
    const id = makeNodeId('set', set.id)
    setNodeIds.set(set.id, id)
    const series = seriesById.get(set.seriesId)
    const image = pickImage(set.logoUrl ?? set.symbolUrl, 'set')
    addNode({
      id,
      gameId: game.id,
      nodeType: 'set',
      entityId: set.id,
      label: set.name,
      subtitle: series?.name ?? null,
      imageUrl: image.imageUrl,
      metadata: {
        slug: set.slug,
        releaseDate: set.releaseDate,
        seriesSlug: series?.slug ?? null,
        seriesName: series?.name ?? null,
        symbolUrl: set.symbolUrl,
        cardCountTotal: set.cardCountTotal,
        cardCountOfficial: set.cardCountOfficial,
        printingCount: printingsBySet.get(set.id) ?? 0,
        imagePlaceholder: image.imagePlaceholder,
      },
    })
  }

  const printingsByIdentity = new Map<string, typeof printings>()
  for (const p of printings) {
    const list = printingsByIdentity.get(p.identityId) ?? []
    list.push(p)
    printingsByIdentity.set(p.identityId, list)
  }
  const identityNodeIds = new Map<string, string>()
  const identityNodeIdByName = new Map<string, string>()
  for (const identity of identityRows) {
    const id = makeNodeId('card_identity', identity.id)
    identityNodeIds.set(identity.id, id)
    // Characters win when several identity types share a name (e.g. "Pikachu" card vs. a Trainer).
    const existing = identityNodeIdByName.get(identity.normalizedName)
    if (!existing || identity.entityType === 'character') {
      identityNodeIdByName.set(identity.normalizedName, id)
    }
    const owned = (printingsByIdentity.get(identity.id) ?? []).slice().sort(byRelease)
    const first = owned[0]
    addNode({
      id,
      gameId: game.id,
      nodeType: 'card_identity',
      entityId: identity.id,
      label: identity.canonicalName,
      subtitle: `${owned.length} ${owned.length === 1 ? 'printing' : 'printings'}`,
      imageUrl: first?.imageFront ?? null,
      metadata: {
        entityType: identity.entityType,
        printingCount: owned.length,
        firstReleaseDate: first?.releaseDate ?? null,
        description: identity.description,
      },
    })
  }

  // A representative image for people and species: the earliest printing that shows them.
  const printingById = new Map(printings.map((p) => [p.id, p]))
  const pickEarlier = (current: typeof printings[number] | undefined, candidate: typeof printings[number]) =>
    !current || byRelease(candidate, current) < 0 ? candidate : current

  const usedArtistIds = new Set(printings.map((p) => p.artistId).filter(Boolean) as string[])
  const printingsByArtist = new Map<string, number>()
  const representativeByArtist = new Map<string, typeof printings[number]>()
  for (const p of printings) {
    if (!p.artistId) continue
    printingsByArtist.set(p.artistId, (printingsByArtist.get(p.artistId) ?? 0) + 1)
    if (p.imageFront) representativeByArtist.set(p.artistId, pickEarlier(representativeByArtist.get(p.artistId), p))
  }
  const artistNodeIds = new Map<string, string>()
  for (const artist of artistRows) {
    if (!usedArtistIds.has(artist.id)) continue
    const id = makeNodeId('artist', artist.id)
    artistNodeIds.set(artist.id, id)
    const count = printingsByArtist.get(artist.id) ?? 0
    addNode({
      id,
      gameId: game.id,
      nodeType: 'artist',
      entityId: artist.id,
      label: artist.name,
      subtitle: `${count} ${count === 1 ? 'illustration' : 'illustrations'}`,
      imageUrl: representativeByArtist.get(artist.id)?.imageFront ?? null,
      metadata: { illustrationCount: count },
    })
  }

  const linksByEntity = new Map<string, number>()
  const representativeByEntity = new Map<string, typeof printings[number]>()
  for (const link of links) {
    linksByEntity.set(link.entityId, (linksByEntity.get(link.entityId) ?? 0) + 1)
    if (link.relation === 'SAME_POKEMON') {
      const p = printingById.get(link.printingId)
      if (p?.imageFront) representativeByEntity.set(link.entityId, pickEarlier(representativeByEntity.get(link.entityId), p))
    }
  }
  const entityNodeIds = new Map<string, string>()
  const entityById = new Map(entityRows.map((e) => [e.id, e]))
  const entityNodeIdByKey = new Map<string, string>()
  for (const entity of entityRows) {
    const kind = entity.kind as EntityKind
    const id = makeNodeId(kind, entity.id)
    entityNodeIds.set(entity.id, id)
    entityNodeIdByKey.set(`${kind}:${entity.key}`, id)
    const count = linksByEntity.get(entity.id) ?? 0
    addNode({
      id,
      gameId: game.id,
      nodeType: kind,
      entityId: entity.id,
      label: entity.name,
      subtitle: entitySubtitle(kind, entity.key, entity.metadata, count),
      imageUrl: kind === 'pokemon' ? (representativeByEntity.get(entity.id)?.imageFront ?? null) : null,
      metadata: { key: entity.key, kind, cardCount: count, ...entity.metadata },
    })
  }

  const printingNodeIds = new Map<string, string>()
  const artistById = new Map(artistRows.map((a) => [a.id, a]))
  const identityById = new Map(identityRows.map((i) => [i.id, i]))
  for (const p of printings) {
    const id = makeNodeId('card_printing', p.id)
    printingNodeIds.set(p.id, id)
    const set = setById.get(p.setId)
    const artist = p.artistId ? artistById.get(p.artistId) : null
    const identity = identityById.get(p.identityId)
    const number = p.printedNumber ?? p.collectorNumber
    addNode({
      id,
      gameId: game.id,
      nodeType: 'card_printing',
      entityId: p.id,
      label: identity?.canonicalName ?? p.collectorNumber,
      subtitle: set ? `${set.name} · ${number}` : number,
      imageUrl: p.imageFront,
      metadata: {
        externalId: p.externalId,
        setId: p.setId,
        setSlug: set?.slug ?? null,
        setName: set?.name ?? null,
        collectorNumber: p.collectorNumber,
        printedNumber: p.printedNumber,
        rarity: p.rarity,
        variant: p.variant,
        finish: p.finish,
        language: p.language,
        category: p.category,
        artist: artist?.name ?? null,
        releaseDate: p.releaseDate,
        hp: (p.attributes as Record<string, unknown>).hp ?? null,
        types: (p.attributes as Record<string, unknown>).types ?? null,
        stage: (p.attributes as Record<string, unknown>).stage ?? null,
        regulationMark: (p.attributes as Record<string, unknown>).regulationMark ?? null,
      },
    })
  }

  // ── edges ──
  const edges = new Map<string, GraphEdge>()
  let skipped = 0
  const addEdge = (
    sourceNodeId: string,
    relationshipType: string,
    targetNodeId: string,
    weight = 1,
    direction: 'directed' | 'undirected' = 'directed',
    metadata: Record<string, unknown> = {},
  ) => {
    if (!nodes.has(sourceNodeId) || !nodes.has(targetNodeId)) {
      skipped += 1
      return
    }
    const id = makeEdgeId(sourceNodeId, relationshipType, targetNodeId)
    if (edges.has(id)) return
    edges.set(id, { id, sourceNodeId, targetNodeId, relationshipType, weight, direction, metadata })
  }

  for (const series of seriesRows) addEdge(seriesNodeIds.get(series.id) as string, 'PART_OF', gameNodeId)
  for (const set of setRows) {
    const seriesNodeId = seriesNodeIds.get(set.seriesId)
    if (seriesNodeId) addEdge(setNodeIds.get(set.id) as string, 'PART_OF', seriesNodeId)
  }

  const linksByPrinting = new Map<string, typeof links>()
  for (const link of links) {
    const list = linksByPrinting.get(link.printingId) ?? []
    list.push(link)
    linksByPrinting.set(link.printingId, list)
  }

  for (const p of printings) {
    const set = setById.get(p.setId)
    const identity = identityById.get(p.identityId)
    const nodeId = printingNodeIds.get(p.id)
    const identityNodeId = identityNodeIds.get(p.identityId)
    const setNodeId = setNodeIds.get(p.setId)
    const seriesNodeId = set ? seriesNodeIds.get(set.seriesId) : undefined
    if (!nodeId || !identityNodeId || !setNodeId || !seriesNodeId || !identity) {
      skipped += 1
      continue
    }
    const context: RelationshipContext = {
      gameNodeId,
      printing: {
        nodeId,
        identityNodeId,
        setNodeId,
        seriesNodeId,
        artistNodeId: p.artistId ? (artistNodeIds.get(p.artistId) ?? null) : null,
        externalId: p.externalId,
        language: p.language,
        attributes: p.attributes as Record<string, unknown>,
        identityName: identity.canonicalName,
        identityNormalizedName: identity.normalizedName,
      },
      entities: (linksByPrinting.get(p.id) ?? []).flatMap((link) => {
        const entity = entityById.get(link.entityId)
        const entityNodeId = entityNodeIds.get(link.entityId)
        if (!entity || !entityNodeId) return []
        return [
          {
            kind: entity.kind as EntityKind,
            key: entity.key,
            relation: link.relation,
            nodeId: entityNodeId,
            metadata: link.metadata as Record<string, unknown>,
          },
        ]
      }),
      identityNodeIdByName: (name) => identityNodeIdByName.get(normalizeName(name)) ?? null,
      entityNodeIdByKey: (kind, key) => entityNodeIdByKey.get(`${kind}:${key}`) ?? null,
    }
    let relationships
    try {
      relationships = adapter.buildRelationships(context)
    } catch (error) {
      throw new GraphError(`Adapter failed to build relationships for ${p.externalId}`, { printingId: p.id }, { cause: error })
    }
    for (const rel of relationships) {
      addEdge(
        rel.sourceNodeId,
        rel.relationshipType,
        rel.targetNodeId,
        rel.weight ?? 1,
        rel.direction ?? 'directed',
        rel.metadata ?? {},
      )
    }
  }

  // Add search text (normalized label + aliases) to every node via metadata-free field.
  const nodeList = [...nodes.values()].map((node) => ({
    ...node,
    metadata: { ...node.metadata },
  }))
  if (skipped > 0) log(`${skipped} edges skipped (missing endpoint)`)
  return { nodes: nodeList, edges: [...edges.values()], skippedEdges: skipped }
}

function byRelease(a: { releaseDate: string | null }, b: { releaseDate: string | null }): number {
  return (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999')
}

function entitySubtitle(
  kind: EntityKind,
  key: string,
  metadata: Record<string, unknown>,
  count: number,
): string {
  const cards = `${count} ${count === 1 ? 'card' : 'cards'}`
  if (kind === 'pokemon') {
    const dex = typeof metadata.dexId === 'number' ? `#${String(metadata.dexId).padStart(4, '0')} · ` : ''
    return `${dex}${cards}`
  }
  if (kind === 'mechanic') return `${key.startsWith('ability:') ? 'Ability' : 'Attack'} · ${cards}`
  if (key.startsWith('type:')) return `Energy type · ${cards}`
  if (key.startsWith('trainer-type:')) return `Trainer type · ${cards}`
  if (key.startsWith('energy-type:')) return `Energy card type · ${cards}`
  return cards
}

export function searchTextFor(node: GraphNode): string {
  const parts = [normalizeName(node.label)]
  const m = node.metadata
  if (node.nodeType === 'card_printing') {
    if (typeof m.setName === 'string') parts.push(normalizeName(m.setName))
    if (typeof m.collectorNumber === 'string') parts.push(m.collectorNumber.toLowerCase())
    if (typeof m.printedNumber === 'string') parts.push(m.printedNumber.toLowerCase())
  }
  if (node.nodeType === 'set' && typeof m.seriesName === 'string') parts.push(normalizeName(m.seriesName))
  if (node.nodeType === 'pokemon' && typeof m.dexId === 'number') parts.push(`#${m.dexId}`)
  if (node.subtitle && node.nodeType !== 'card_printing') parts.push(normalizeName(node.subtitle))
  return [...new Set(parts)].join(' ')
}

async function writeProjection(db: Db, gameId: string, nodes: GraphNode[], edges: GraphEdge[]) {
  await db.transaction(async (tx) => {
    await tx.delete(graphNodes).where(eq(graphNodes.gameId, gameId))
    const now = new Date().toISOString()
    for (let i = 0; i < nodes.length; i += CHUNK) {
      const chunk = nodes.slice(i, i + CHUNK).map((n) => ({
        id: n.id,
        gameId: n.gameId,
        nodeType: n.nodeType as NodeType,
        entityId: n.entityId,
        label: n.label,
        subtitle: n.subtitle,
        imageUrl: n.imageUrl,
        searchText: searchTextFor(n),
        metadata: n.metadata,
        createdAt: now,
        updatedAt: now,
      }))
      await tx.insert(graphNodes).values(chunk)
    }
    for (let i = 0; i < edges.length; i += CHUNK) {
      const chunk = edges.slice(i, i + CHUNK).map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        relationshipType: e.relationshipType,
        weight: e.weight,
        direction: e.direction,
        metadata: e.metadata,
        createdAt: now,
      }))
      await tx.insert(graphEdges).values(chunk)
    }
  })
}
