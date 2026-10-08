import type { GraphEdge, GraphNode, NodeType } from '@constellation/domain'

export interface NodeRow {
  id: string
  game_id: string
  node_type: string
  entity_id: string
  label: string
  subtitle: string | null
  image_url: string | null
  metadata: Record<string, unknown> | string | null
}

export interface EdgeRow {
  id: string
  source_node_id: string
  target_node_id: string
  relationship_type: string
  weight: number | string
  direction: string
  metadata: Record<string, unknown> | string | null
}

function json(value: Record<string, unknown> | string | null | undefined): Record<string, unknown> {
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

export function toGraphNode(row: NodeRow): GraphNode {
  return {
    id: row.id,
    gameId: row.game_id,
    nodeType: row.node_type as NodeType,
    entityId: row.entity_id,
    label: row.label,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    metadata: json(row.metadata),
  }
}

export function toGraphEdge(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    relationshipType: row.relationship_type,
    weight: Number(row.weight),
    direction: row.direction === 'undirected' ? 'undirected' : 'directed',
    metadata: json(row.metadata),
  }
}

/** Drizzle `execute` returns driver-specific shapes; normalise to rows. */
export function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows
  }
  return []
}
