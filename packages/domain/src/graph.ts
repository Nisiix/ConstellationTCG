export const NODE_TYPES = [
  'game',
  'series',
  'set',
  'card_identity',
  'card_printing',
  'pokemon',
  'artist',
  'mechanic',
  'attribute',
  'digital_asset',
] as const

export type NodeType = (typeof NODE_TYPES)[number]

export const UNIVERSAL_RELATIONSHIPS = [
  'BELONGS_TO',
  'PART_OF',
  'PRINTING_OF',
  'SAME_IDENTITY',
  'SAME_SET',
  'SAME_SERIES',
  'SAME_ARTIST',
  'SAME_LANGUAGE',
  'SAME_VARIANT',
  'ALTERNATE_PRINTING',
  'REPRINT_OF',
  'RELATED_TO',
  'EVOLUTION_OF',
  'HAS_ATTRIBUTE',
  'ILLUSTRATED_BY',
  'REPRESENTS_ASSET',
  'OWNED_BY',
] as const

export type UniversalRelationship = (typeof UNIVERSAL_RELATIONSHIPS)[number]

/**
 * Relationship type. Universal types are known to the core; adapters may add their own
 * (e.g. Pokemon `EVOLVES_FROM`, `HAS_TYPE`). The core treats them as opaque strings.
 */
export type RelationshipType = UniversalRelationship | (string & {})

export type EdgeDirection = 'directed' | 'undirected'

export interface GraphNode {
  id: string
  gameId: string
  nodeType: NodeType
  entityId: string
  label: string
  subtitle: string | null
  imageUrl: string | null
  metadata: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  relationshipType: RelationshipType
  weight: number
  direction: EdgeDirection
  metadata: Record<string, unknown>
}

/** A relationship emitted by an adapter, before it is persisted as an edge. */
export interface GraphRelationship {
  sourceNodeId: string
  targetNodeId: string
  relationshipType: RelationshipType
  weight?: number
  direction?: EdgeDirection
  metadata?: Record<string, unknown>
}

export interface GraphNeighborhood {
  focus: GraphNode
  nodes: GraphNode[]
  edges: GraphEdge[]
  meta: {
    depth: number
    truncated: boolean
    nodeCount: number
    edgeCount: number
    /** Hop distance from the focus node, keyed by node id. */
    distances: Record<string, number>
  }
}

export interface RelationshipSummary {
  relationshipType: RelationshipType
  /** `out`: focus is the source; `in`: focus is the target. */
  direction: 'out' | 'in'
  count: number
}

export const MAX_GRAPH_DEPTH = 3

export function makeEdgeId(
  sourceNodeId: string,
  relationshipType: RelationshipType,
  targetNodeId: string,
): string {
  return `${sourceNodeId}|${relationshipType}|${targetNodeId}`
}
