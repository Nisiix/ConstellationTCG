/**
 * Focus neighborhood: the sub-graph around one node, bounded in depth and size.
 *
 * Breadth-first over `graph_edges`, with a per-node fan-out cap (hub nodes such as a type or a
 * big set have thousands of edges) and a global node cap. Progressive disclosure is enforced here,
 * not in the UI.
 */
import { sql, type Db } from '@constellation/database'
import {
  GraphError,
  MAX_GRAPH_DEPTH,
  parseNodeId,
  type GraphEdge,
  type GraphNeighborhood,
  type GraphNode,
  type NodeType,
} from '@constellation/domain'
import { rows, toGraphEdge, toGraphNode, type EdgeRow, type NodeRow } from './rows'

export interface NeighborhoodOptions {
  /** Hops from the focus node (0..3). Default 1. */
  depth?: number
  /** Maximum nodes returned (focus included). Default 300. */
  limit?: number
  /** Maximum neighbors expanded per node, best weight first. Default 60. */
  perNodeLimit?: number
  /** Only follow these relationship types. */
  relationshipTypes?: string[] | null
  /** Only include neighbors of these node types. */
  nodeTypes?: NodeType[] | null
  /** Never include neighbors of these node types. */
  excludeNodeTypes?: NodeType[] | null
  /** When set, only these card_printing node ids may appear (schema-driven filters). */
  allowedPrintingNodeIds?: Set<string> | null
  /** Cap on edges returned. Default 3000. */
  edgeLimit?: number
}

const DEFAULTS = { depth: 1, limit: 300, perNodeLimit: 60, edgeLimit: 3000 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)))
}

export async function getNeighborhood(
  db: Db,
  nodeId: string,
  options: NeighborhoodOptions = {},
): Promise<GraphNeighborhood> {
  const depth = clamp(options.depth ?? DEFAULTS.depth, 0, MAX_GRAPH_DEPTH)
  const limit = clamp(options.limit ?? DEFAULTS.limit, 1, 2000)
  const perNode = clamp(options.perNodeLimit ?? DEFAULTS.perNodeLimit, 1, 1000)
  const edgeLimit = clamp(options.edgeLimit ?? DEFAULTS.edgeLimit, 1, 20000)
  const relationshipTypes = options.relationshipTypes?.length ? new Set(options.relationshipTypes) : null
  const nodeTypes = options.nodeTypes?.length ? new Set(options.nodeTypes) : null
  const excluded = options.excludeNodeTypes?.length ? new Set(options.excludeNodeTypes) : null

  const focusRows = await loadNodes(db, [nodeId])
  const focus = focusRows[0]
  if (!focus) throw new GraphError(`Node not found: ${nodeId}`, { nodeId, status: 404 })

  const distances = new Map<string, number>([[nodeId, 0]])
  let truncated = false
  let frontier = [nodeId]

  const allowed = (id: string): boolean => {
    const parsed = parseNodeId(id)
    if (!parsed) return false
    if (excluded?.has(parsed.type)) return false
    if (nodeTypes && !nodeTypes.has(parsed.type)) return false
    if (
      options.allowedPrintingNodeIds &&
      parsed.type === 'card_printing' &&
      !options.allowedPrintingNodeIds.has(id)
    ) {
      return false
    }
    return true
  }

  for (let d = 1; d <= depth && frontier.length > 0; d += 1) {
    const edgeRows = await loadFrontierEdges(db, frontier, perNode, relationshipTypes)
    const next: string[] = []
    for (const row of edgeRows) {
      const anchor = row.anchor
      const other = row.source_node_id === anchor ? row.target_node_id : row.source_node_id
      if (distances.has(other)) continue
      if (!allowed(other)) continue
      if (distances.size >= limit) {
        truncated = true
        break
      }
      distances.set(other, d)
      next.push(other)
    }
    if (truncated) break
    frontier = next
  }

  const ids = [...distances.keys()]
  const [nodeRows, edgeRows] = await Promise.all([
    loadNodes(db, ids),
    loadEdgesAmong(db, ids, relationshipTypes, edgeLimit),
  ])
  const nodes = nodeRows.sort(
    (a, b) =>
      (distances.get(a.id) ?? 0) - (distances.get(b.id) ?? 0) || a.label.localeCompare(b.label),
  )
  const edges = edgeRows
  return {
    focus,
    nodes,
    edges,
    meta: {
      depth,
      truncated: truncated || edges.length >= edgeLimit,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      distances: Object.fromEntries(distances),
    },
  }
}

function idList(ids: string[]) {
  return sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )
}

export async function loadNodes(db: Db, ids: string[]): Promise<GraphNode[]> {
  if (ids.length === 0) return []
  const result = await db.execute(
    sql`select id, game_id, node_type, entity_id, label, subtitle, image_url, metadata
        from graph_nodes where id in (${idList(ids)})`,
  )
  return rows<NodeRow>(result).map(toGraphNode)
}

interface FrontierEdgeRow extends EdgeRow {
  anchor: string
}

async function loadFrontierEdges(
  db: Db,
  frontier: string[],
  perNode: number,
  relationshipTypes: Set<string> | null,
): Promise<FrontierEdgeRow[]> {
  const list = idList(frontier)
  const typeFilter = relationshipTypes
    ? sql`and e.relationship_type in (${idList([...relationshipTypes])})`
    : sql``
  const result = await db.execute(sql`
    select * from (
      select e.id, e.source_node_id, e.target_node_id, e.relationship_type, e.weight, e.direction, e.metadata,
        case when e.source_node_id in (${list}) then e.source_node_id else e.target_node_id end as anchor,
        row_number() over (
          partition by case when e.source_node_id in (${list}) then e.source_node_id else e.target_node_id end
          order by e.weight desc, e.id
        ) as rn
      from graph_edges e
      where (e.source_node_id in (${list}) or e.target_node_id in (${list})) ${typeFilter}
    ) ranked
    where rn <= ${perNode}
    order by anchor, rn
  `)
  return rows<FrontierEdgeRow>(result)
}

async function loadEdgesAmong(
  db: Db,
  ids: string[],
  relationshipTypes: Set<string> | null,
  limit: number,
): Promise<GraphEdge[]> {
  if (ids.length < 2) return []
  const list = idList(ids)
  const typeFilter = relationshipTypes
    ? sql`and e.relationship_type in (${idList([...relationshipTypes])})`
    : sql``
  const result = await db.execute(sql`
    select e.id, e.source_node_id, e.target_node_id, e.relationship_type, e.weight, e.direction, e.metadata
    from graph_edges e
    where e.source_node_id in (${list}) and e.target_node_id in (${list}) ${typeFilter}
    order by e.weight desc, e.id
    limit ${limit}
  `)
  return rows<EdgeRow>(result).map(toGraphEdge)
}
