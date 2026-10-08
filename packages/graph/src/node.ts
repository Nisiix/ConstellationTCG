import { sql, type Db } from '@constellation/database'
import type { GraphNode, RelationshipSummary } from '@constellation/domain'
import { loadNodes } from './neighborhood'
import { rows } from './rows'

export async function getNode(db: Db, nodeId: string): Promise<GraphNode | null> {
  const [node] = await loadNodes(db, [nodeId])
  return node ?? null
}

/** How many edges of each type touch a node, split by direction. */
export async function getRelationshipSummary(
  db: Db,
  nodeId: string,
): Promise<RelationshipSummary[]> {
  const result = await db.execute(sql`
    select relationship_type, direction, count(*)::int as count from (
      select relationship_type, 'out' as direction from graph_edges where source_node_id = ${nodeId}
      union all
      select relationship_type, 'in' as direction from graph_edges where target_node_id = ${nodeId}
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
