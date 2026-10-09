import { sql, type Db } from '@constellation/database'
import { parseNodeId, type GraphNode, type NodeType, type RelationshipSummary } from '@constellation/domain'
import { loadNodes } from './neighborhood'
import { rows, toGraphNode, type NodeRow } from './rows'

export async function getNode(db: Db, nodeId: string): Promise<GraphNode | null> {
  const [node] = await loadNodes(db, [nodeId])
  return node ?? null
}

export interface SummaryOptions {
  /** Count only edges whose other end is one of these node types (the neighborhood's own filter). */
  nodeTypes?: NodeType[] | null
  excludeNodeTypes?: NodeType[] | null
  relationshipTypes?: string[] | null
}

function list(values: readonly string[]) {
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )
}

/**
 * How many edges of each type touch a node, split by direction. With the same filters as the
 * neighborhood, the totals describe what the neighborhood would show in full, not the raw graph.
 * An undirected edge (two similar sets) reads the same from both ends: it counts as `out`.
 */
export async function getRelationshipSummary(
  db: Db,
  nodeId: string,
  options: SummaryOptions = {},
): Promise<RelationshipSummary[]> {
  const typeFilter = options.nodeTypes?.length ? sql`and n.node_type in (${list(options.nodeTypes)})` : sql``
  const excludeFilter = options.excludeNodeTypes?.length ? sql`and n.node_type not in (${list(options.excludeNodeTypes)})` : sql``
  const relFilter = options.relationshipTypes?.length ? sql`and e.relationship_type in (${list(options.relationshipTypes)})` : sql``
  const result = await db.execute(sql`
    select relationship_type, direction, count(*)::int as count from (
      select e.relationship_type, 'out' as direction from graph_edges e
        join graph_nodes n on n.id = e.target_node_id
        where e.source_node_id = ${nodeId} ${typeFilter} ${excludeFilter} ${relFilter}
      union all
      select e.relationship_type, case when e.direction = 'undirected' then 'out' else 'in' end as direction from graph_edges e
        join graph_nodes n on n.id = e.source_node_id
        where e.target_node_id = ${nodeId} ${typeFilter} ${excludeFilter} ${relFilter}
    ) t
    group by relationship_type, direction
    order by count desc, relationship_type asc
  `)
  return rows<{ relationship_type: string; direction: 'out' | 'in'; count: number | string }>(result).map(
    (r) => ({
      relationshipType: r.relationship_type,
      direction: r.direction,
      count: Number(r.count),
    }),
  )
}

export interface GraphStats {
  nodes: number
  edges: number
  byNodeType: Record<string, number>
}

export async function getGraphStats(db: Db, gameSlug?: string): Promise<GraphStats> {
  const gameFilter = gameSlug ? sql`where g.slug = ${gameSlug}` : sql``
  const nodeRows = rows<{ node_type: string; count: number | string }>(
    await db.execute(sql`
      select n.node_type, count(*)::int as count
      from graph_nodes n join tcg_games g on g.id = n.game_id ${gameFilter}
      group by n.node_type
    `),
  )
  const edgeRows = rows<{ count: number | string }>(
    await db.execute(sql`
      select count(*)::int as count
      from graph_edges e join graph_nodes n on n.id = e.source_node_id
      join tcg_games g on g.id = n.game_id ${gameFilter}
    `),
  )
  const byNodeType: Record<string, number> = {}
  let nodes = 0
  for (const r of nodeRows) {
    byNodeType[r.node_type] = Number(r.count)
    nodes += Number(r.count)
  }
  return { nodes, edges: Number(edgeRows[0]?.count ?? 0), byNodeType }
}

export interface ConnectionOptions {
  relationshipType: string
  /** `out`: the node is the source (or either end of an undirected edge); `in`: the target. */
  direction: 'out' | 'in'
  offset?: number
  /** Page size. Default 60, at most 500. */
  limit?: number
  nodeTypes?: NodeType[] | null
  /** When set, only these card_printing node ids may be listed (schema-driven filters). */
  allowedPrintingNodeIds?: Set<string> | null
}

export interface ConnectionItem {
  node: GraphNode
  weight: number
  metadata: Record<string, unknown>
}

/**
 * Every connection of one kind, a page at a time: what a "show all" list reads. The order is the
 * focus panel's: a set's cards by collector number; expansions and printings newest first;
 * everything else strongest first, then by name.
 */
export async function getConnections(
  db: Db,
  nodeId: string,
  options: ConnectionOptions,
): Promise<{ items: ConnectionItem[]; total: number }> {
  const offset = Math.max(0, Math.floor(options.offset ?? 0))
  const limit = Math.min(500, Math.max(1, Math.floor(options.limit ?? 60)))
  const typeFilter = options.nodeTypes?.length ? sql`and n.node_type in (${list(options.nodeTypes)})` : sql``
  const ends =
    options.direction === 'out'
      ? sql`(e.source_node_id = ${nodeId} or (e.target_node_id = ${nodeId} and e.direction = 'undirected'))`
      : sql`(e.target_node_id = ${nodeId} and e.direction <> 'undirected')`
  const byNumber = parseNodeId(nodeId)?.type === 'set' && options.relationshipType === 'BELONGS_TO'
  const order = byNumber
    ? sql`length(coalesce(n.metadata->>'collectorNumber', '')), coalesce(n.metadata->>'collectorNumber', '') collate "C"`
    : sql`case when n.node_type in ('set', 'series', 'card_printing')
             then coalesce(n.metadata->>'releaseDate', n.metadata->>'firstReleaseDate', '') else '' end desc,
           e.weight desc`
  const result = await db.execute(sql`
    select n.id, n.game_id, n.node_type, n.entity_id, n.label, n.subtitle, n.image_url, n.metadata,
      e.weight as edge_weight, e.metadata as edge_metadata
    from graph_edges e
    join graph_nodes n on n.id = case when e.source_node_id = ${nodeId} then e.target_node_id else e.source_node_id end
    where e.relationship_type = ${options.relationshipType} and ${ends} ${typeFilter}
    order by ${order}, n.label, n.id
  `)
  const allowed = options.allowedPrintingNodeIds
  const all = rows<NodeRow & { edge_weight: number | string; edge_metadata: Record<string, unknown> | string | null }>(result)
    .filter((r) => !allowed || r.node_type !== 'card_printing' || allowed.has(r.id))
    .map((r) => ({
      node: toGraphNode(r),
      weight: Number(r.edge_weight),
      metadata: toGraphNode({ ...r, metadata: r.edge_metadata }).metadata,
    }))
  return { items: all.slice(offset, offset + limit), total: all.length }
}
