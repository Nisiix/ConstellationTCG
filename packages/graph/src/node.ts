import { sql, type Db } from '@constellation/database'
import type { GraphNode, NodeType, RelationshipSummary } from '@constellation/domain'
import { loadNodes } from './neighborhood'
import { rows } from './rows'

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
      select e.relationship_type, 'in' as direction from graph_edges e
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
