/**
 * Pure composition of graph nodes and edges from catalog rows.
 *
 * Shared by the one-shot builder (everything in memory, `builder.ts`) and the resumable builder
 * (aggregates from SQL, one bounded step at a time, `incremental.ts`) so that both produce exactly
 * the same projection. Nothing here touches the database.
 */
import type {
  artists,
  cardIdentities,
  cardPrintings,
  entities,
  printingEntities,
  tcgGames,
  tcgSeries,
  tcgSets,
} from '@constellation/database'
import {
  GraphError,
  makeEdgeId,
  makeNodeId,
  normalizeName,
  type EntityKind,
  type GraphEdge,
  type GraphNode,
  type GraphRelationship,
  type NodeType,
  type RelationshipContext,
  type TCGAdapter,
} from '@constellation/domain'

export type GameRow = typeof tcgGames.$inferSelect
export type SeriesRow = typeof tcgSeries.$inferSelect
export type SetRow = typeof tcgSets.$inferSelect
export type IdentityRow = typeof cardIdentities.$inferSelect
export type PrintingRow = typeof cardPrintings.$inferSelect
export type ArtistRow = typeof artists.$inferSelect
export type EntityRow = typeof entities.$inferSelect
export type LinkRow = typeof printingEntities.$inferSelect

export type Placeholders = Partial<Record<NodeType, string>>

/** Stand-in for a missing release date: sorts after every real date. */
export const NO_RELEASE = '9999'

/** What orders the printings of one card: release date, collector number (digits by length), id. */
export interface PrintingOrder {
  releaseDate: string | null
  collectorNumber: string
  externalId: string
}

/** Byte-wise comparison: the same order as `collate "C"` in SQL, whatever the database collation. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function comparePrintings(a: PrintingOrder, b: PrintingOrder): number {
  return (
    compareText(a.releaseDate ?? NO_RELEASE, b.releaseDate ?? NO_RELEASE) ||
    a.collectorNumber.length - b.collectorNumber.length ||
    compareText(a.collectorNumber, b.collectorNumber) ||
    compareText(a.externalId, b.externalId)
  )
}

/**
 * SQL twin of `comparePrintings`, for `order by` and `distinct on`. `p` must be the printings
 * alias and `s` its set (the set's release date stands in for a printing without one).
 */
export const PRINTING_ORDER_SQL = `coalesce(p.release_date::text, s.release_date::text, '9999'), length(p.collector_number), p.collector_number collate "C", p.external_id collate "C"`

/** A printing's release date, else its set's. */
export function releaseOf(p: { releaseDate: string | null }, set: { releaseDate: string | null } | undefined): string | null {
  return p.releaseDate ?? set?.releaseDate ?? null
}

/**
 * Sets and series without an image of their own show the game's standard image instead
 * (Pokémon: the classic Base Set logo). `imagePlaceholder` tells the UI it is a stand-in.
 */
export function pickImage(
  placeholders: Placeholders,
  own: string | null | undefined,
  type: NodeType,
): { imageUrl: string | null; imagePlaceholder: boolean } {
  if (own) return { imageUrl: own, imagePlaceholder: false }
  const fallback = placeholders[type]
  return fallback ? { imageUrl: fallback, imagePlaceholder: true } : { imageUrl: null, imagePlaceholder: false }
}

// ───────────────────────────── nodes ─────────────────────────────

export function composeGameNode(
  game: GameRow,
  counts: { seriesCount: number; setCount: number },
  placeholders: Placeholders,
): GraphNode {
  const image = pickImage(placeholders, null, 'game')
  return {
    id: makeNodeId('game', game.id),
    gameId: game.id,
    nodeType: 'game',
    entityId: game.id,
    label: game.name,
    subtitle: game.publisher,
    imageUrl: image.imageUrl,
    metadata: {
      slug: game.slug,
      seriesCount: counts.seriesCount,
      setCount: counts.setCount,
      imagePlaceholder: image.imagePlaceholder,
    },
  }
}

export function composeSeriesNode(gameId: string, series: SeriesRow, setCount: number, placeholders: Placeholders): GraphNode {
  const image = pickImage(placeholders, series.logoUrl, 'series')
  return {
    id: makeNodeId('series', series.id),
    gameId,
    nodeType: 'series',
    entityId: series.id,
    label: series.name,
    subtitle: `${setCount} ${setCount === 1 ? 'set' : 'sets'}`,
    imageUrl: image.imageUrl,
    metadata: {
      slug: series.slug,
      releaseDate: series.releaseDate,
      setCount,
      imagePlaceholder: image.imagePlaceholder,
    },
  }
}

export function composeSetNode(
  gameId: string,
  set: SetRow,
  series: SeriesRow | undefined,
  printingCount: number,
  placeholders: Placeholders,
): GraphNode {
  const image = pickImage(placeholders, set.logoUrl ?? set.symbolUrl, 'set')
  return {
    id: makeNodeId('set', set.id),
    gameId,
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
      printingCount,
      imagePlaceholder: image.imagePlaceholder,
    },
  }
}

/** The earliest printing of a card (by `comparePrintings`), what the identity shows. */
export interface FirstPrinting {
  releaseDate: string | null
  imageFront: string | null
}

export function composeIdentityNode(
  gameId: string,
  identity: IdentityRow,
  printingCount: number,
  first: FirstPrinting | null,
): GraphNode {
  return {
    id: makeNodeId('card_identity', identity.id),
    gameId,
    nodeType: 'card_identity',
    entityId: identity.id,
    label: identity.canonicalName,
    subtitle: `${printingCount} ${printingCount === 1 ? 'printing' : 'printings'}`,
    imageUrl: first?.imageFront ?? null,
    metadata: {
      entityType: identity.entityType,
      printingCount,
      firstReleaseDate: first?.releaseDate ?? null,
      description: identity.description,
    },
  }
}

export function composeArtistNode(gameId: string, artist: ArtistRow, illustrationCount: number, imageUrl: string | null): GraphNode {
  return {
    id: makeNodeId('artist', artist.id),
    gameId,
    nodeType: 'artist',
    entityId: artist.id,
    label: artist.name,
    subtitle: `${illustrationCount} ${illustrationCount === 1 ? 'illustration' : 'illustrations'}`,
    imageUrl,
    metadata: { illustrationCount },
  }
}

/** `imageUrl` is the representative card (earliest SAME_POKEMON printing with an image); only species show it. */
export function composeEntityNode(gameId: string, entity: EntityRow, cardCount: number, imageUrl: string | null): GraphNode {
  const kind = entity.kind as EntityKind
  return {
    id: makeNodeId(kind, entity.id),
    gameId,
    nodeType: kind,
    entityId: entity.id,
    label: entity.name,
    subtitle: entitySubtitle(kind, entity.key, entity.metadata, cardCount),
    imageUrl: kind === 'pokemon' ? imageUrl : null,
    metadata: { key: entity.key, kind, cardCount, ...entity.metadata },
  }
}

export function composePrintingNode(
  gameId: string,
  p: PrintingRow,
  set: SetRow | undefined,
  artist: ArtistRow | undefined,
  identity: IdentityRow | undefined,
): GraphNode {
  const number = p.printedNumber ?? p.collectorNumber
  const attributes = p.attributes as Record<string, unknown>
  return {
    id: makeNodeId('card_printing', p.id),
    gameId,
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
      hp: attributes.hp ?? null,
      types: attributes.types ?? null,
      stage: attributes.stage ?? null,
      regulationMark: attributes.regulationMark ?? null,
    },
  }
}

export function entitySubtitle(kind: EntityKind, key: string, metadata: Record<string, unknown>, count: number): string {
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

/** Normalized label plus the words a person would type to find the node. */
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

/** Entity kinds that become points: the ones the adapter declares as node types (Pokémon: species only). */
export function projectedEntityKinds(adapter: TCGAdapter): Set<string> {
  return new Set<string>(adapter.definition().nodeTypes)
}

/** A printing's evolution stage (or the game's equivalent), used to compare the make-up of sets. */
export function stageOf(attributes: unknown): string | null {
  const stage = (attributes as Record<string, unknown> | null)?.stage
  return typeof stage === 'string' && stage ? stage : null
}

// ───────────────────────────── lookups ─────────────────────────────

/** Per set, the printing node ids of each card name (normalized), for in-set links such as evolutions. */
export function setPrintingIndex(
  printings: Array<{ id: string; setId: string; identityId: string }>,
  normalizedNameOf: (identityId: string) => string | undefined,
): Map<string, Map<string, string[]>> {
  const index = new Map<string, Map<string, string[]>>()
  for (const p of [...printings].sort((a, b) => compareText(a.id, b.id))) {
    const name = normalizedNameOf(p.identityId)
    if (!name) continue
    const bySet = index.get(p.setId) ?? new Map<string, string[]>()
    bySet.set(name, [...(bySet.get(name) ?? []), makeNodeId('card_printing', p.id)])
    index.set(p.setId, bySet)
  }
  return index
}

/**
 * Identity node id by normalized name. Characters win when several identity types share a name
 * (e.g. "Pikachu" card vs. a Trainer); otherwise the smallest id, so the choice is deterministic.
 */
export function identityNodeIdsByName(
  identities: Array<{ id: string; normalizedName: string; entityType: string }>,
): Map<string, string> {
  const sorted = [...identities].sort(
    (a, b) =>
      Number(b.entityType === 'character') - Number(a.entityType === 'character') || compareText(a.id, b.id),
  )
  const map = new Map<string, string>()
  for (const identity of sorted) {
    if (!map.has(identity.normalizedName)) map.set(identity.normalizedName, makeNodeId('card_identity', identity.id))
  }
  return map
}

// ───────────────────────────── edges ─────────────────────────────

/** Universal catalog edges: series → game, set → series. */
export function catalogRelationships(gameNodeId: string, seriesRows: SeriesRow[], setRows: SetRow[]): GraphRelationship[] {
  const seriesIds = new Set(seriesRows.map((s) => s.id))
  const out: GraphRelationship[] = []
  for (const series of seriesRows) {
    out.push({ sourceNodeId: makeNodeId('series', series.id), relationshipType: 'PART_OF', targetNodeId: gameNodeId })
  }
  for (const set of setRows) {
    if (!seriesIds.has(set.seriesId)) continue
    out.push({ sourceNodeId: makeNodeId('set', set.id), relationshipType: 'PART_OF', targetNodeId: makeNodeId('series', set.seriesId) })
  }
  return out
}

export interface PrintingContextInput {
  gameNodeId: string
  printing: PrintingRow
  identity: IdentityRow
  artistNodeId: string | null
  /** This printing's entity links, with the entity's kind and key. */
  links: Array<{ kind: EntityKind; key: string; relation: string; entityNodeId: string; metadata: Record<string, unknown> }>
  identityNodeIdByName: (normalizedName: string) => string | null
  entityNodeIdByKey: (kind: EntityKind, key: string) => string | null
  /** This printing's set: printing node ids by card name. */
  setPrintingNodeIdsByName: (normalizedName: string) => string[]
}

/** The adapter's relationships for one printing, from a context that needs no database. */
export function relationshipsForPrinting(adapter: TCGAdapter, input: PrintingContextInput): GraphRelationship[] {
  const p = input.printing
  const context: RelationshipContext = {
    gameNodeId: input.gameNodeId,
    printing: {
      nodeId: makeNodeId('card_printing', p.id),
      identityNodeId: makeNodeId('card_identity', p.identityId),
      setNodeId: makeNodeId('set', p.setId),
      seriesNodeId: '',
      artistNodeId: input.artistNodeId,
      externalId: p.externalId,
      language: p.language,
      attributes: p.attributes as Record<string, unknown>,
      identityName: input.identity.canonicalName,
      identityNormalizedName: input.identity.normalizedName,
    },
    entities: input.links.map((link) => ({
      kind: link.kind,
      key: link.key,
      relation: link.relation,
      nodeId: link.entityNodeId,
      metadata: link.metadata,
    })),
    identityNodeIdByName: input.identityNodeIdByName,
    entityNodeIdByKey: input.entityNodeIdByKey,
    setPrintingNodeIdsByName: input.setPrintingNodeIdsByName,
  }
  try {
    return adapter.buildRelationships(context)
  } catch (error) {
    throw new GraphError(`Adapter failed to build relationships for ${p.externalId}`, { printingId: p.id }, { cause: error })
  }
}

/**
 * Reprints (universal, TCG agnostic): every later printing of a card points at the card's first
 * printing. One edge per reprint rather than a clique, so the original is the hub of all its
 * reprints and "reprint of" is a connection of its own, not only a list derived from the identity.
 */
export function reprintRelationships(printings: Array<PrintingOrder & { id: string }>): GraphRelationship[] {
  if (printings.length < 2) return []
  const sorted = [...printings].sort(comparePrintings)
  const first = sorted[0]
  if (!first) return []
  const firstNodeId = makeNodeId('card_printing', first.id)
  return sorted.slice(1).map((reprint) => ({
    sourceNodeId: makeNodeId('card_printing', reprint.id),
    relationshipType: 'REPRINT_OF',
    targetNodeId: firstNodeId,
    weight: 0.7,
    direction: 'directed',
    metadata: { firstExternalId: first.externalId },
  }))
}

export function toEdge(rel: GraphRelationship): GraphEdge {
  return {
    id: makeEdgeId(rel.sourceNodeId, rel.relationshipType, rel.targetNodeId),
    sourceNodeId: rel.sourceNodeId,
    targetNodeId: rel.targetNodeId,
    relationshipType: rel.relationshipType,
    weight: rel.weight ?? 1,
    direction: rel.direction ?? 'directed',
    metadata: rel.metadata ?? {},
  }
}

/** Keeps the first edge per id and drops edges whose endpoints are not nodes of the projection. */
export class EdgeCollector {
  readonly edges = new Map<string, GraphEdge>()
  skipped = 0

  constructor(private readonly known: (nodeId: string) => boolean) {}

  add(rel: GraphRelationship): void {
    if (!this.known(rel.sourceNodeId) || !this.known(rel.targetNodeId)) {
      this.skipped += 1
      return
    }
    const edge = toEdge(rel)
    if (!this.edges.has(edge.id)) this.edges.set(edge.id, edge)
  }

  addAll(rels: Iterable<GraphRelationship>): void {
    for (const rel of rels) this.add(rel)
  }

  list(): GraphEdge[] {
    return [...this.edges.values()]
  }
}
