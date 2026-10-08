/**
 * Contracts between the core and a TCG adapter.
 *
 * `Source*` types are what an adapter fetches from its data source (already stripped of anything
 * the product must not store, e.g. prices). `Normalized*` types are what the ingestion pipeline
 * persists. The adapter is the only place that knows the source vocabulary.
 */
import type { EntityKind, Finish, IdentityEntityType } from './catalog'
import type { FilterDefinition } from './filters'
import type { GraphRelationship, NodeType } from './graph'
import type { TCGTheme } from './theme'

export interface TCGDefinition {
  slug: string
  name: string
  publisher: string | null
  adapterKey: string
  /** Relationship types this adapter emits beyond the universal set. */
  relationshipTypes: string[]
  /** Node types this adapter emits beyond the universal set. */
  nodeTypes: NodeType[]
  /** Game-scoped filter definitions (values are computed by the filters package). */
  filters: FilterDefinition[]
  /** Visual theme: the palette that makes this game recognizable in the dark UI. */
  theme: TCGTheme
}

export interface SourceSeries {
  externalId: string
  name: string
  releaseDate: string | null
  logoUrl: string | null
  raw: Record<string, unknown>
}

export interface SourceSet {
  externalId: string
  seriesExternalId: string
  name: string
  releaseDate: string | null
  symbolUrl: string | null
  logoUrl: string | null
  cardCountTotal: number | null
  cardCountOfficial: number | null
  raw: Record<string, unknown>
}

export interface SourceCard {
  externalId: string
  setExternalId: string
  language: string
  raw: Record<string, unknown>
}

export interface NormalizedEntityRef {
  kind: EntityKind
  key: string
  name: string
  /** How the card relates to the entity, e.g. `SAME_POKEMON`, `HAS_TYPE`, `WEAK_TO`. */
  relation: string
  metadata?: Record<string, unknown>
}

export interface NormalizedCard {
  externalId: string
  setExternalId: string
  language: string
  name: string
  identityEntityType: IdentityEntityType
  collectorNumber: string
  printedNumber: string | null
  category: string | null
  rarity: string | null
  variant: string
  finish: Finish
  artistName: string | null
  imageFront: string | null
  imageBack: string | null
  description: string | null
  /** Adapter-specific attributes, persisted as JSON on the printing. */
  attributes: Record<string, unknown>
  /** Non-card entities this card references (species, types, mechanics). */
  entities: NormalizedEntityRef[]
  /** Content hash of the (stripped) raw record, used for incremental change detection. */
  rawHash: string
}

export interface IdentityResolution {
  canonicalName: string
  normalizedName: string
  entityType: IdentityEntityType
  description: string | null
}

/**
 * The context a relationship builder receives: everything it needs to produce node ids without
 * touching the database. Keyed lookups are built by the graph builder.
 */
export interface RelationshipContext {
  gameNodeId: string
  printing: {
    nodeId: string
    identityNodeId: string
    setNodeId: string
    seriesNodeId: string
    artistNodeId: string | null
    externalId: string
    language: string
    attributes: Record<string, unknown>
    identityName: string
    identityNormalizedName: string
  }
  /** Entities linked to this printing (from `printing_entities`), with their graph node ids. */
  entities: Array<{
    kind: EntityKind
    key: string
    relation: string
    nodeId: string
    metadata: Record<string, unknown>
  }>
  /** Lookup of an identity node id in the same game by normalized name. */
  identityNodeIdByName: (normalizedName: string) => string | null
  /** Lookup of an entity node id in the same game by kind and key. */
  entityNodeIdByKey: (kind: EntityKind, key: string) => string | null
}

export interface ListCardsOptions {
  /** Restrict to these set external ids (used by the vertical slice and fixtures). */
  setExternalIds?: string[]
  /** Progress callback (fetched, total). */
  onProgress?: (fetched: number, total: number) => void
}

export interface TCGAdapter {
  definition(): TCGDefinition
  listSeries(): Promise<SourceSeries[]>
  listSets(): Promise<SourceSet[]>
  listCards(options?: ListCardsOptions): Promise<SourceCard[]>
  normalizeCard(card: SourceCard): NormalizedCard
  resolveIdentity(card: NormalizedCard): IdentityResolution
  buildRelationships(context: RelationshipContext): GraphRelationship[]
}
