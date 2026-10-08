/**
 * Universe view: what a visitor sees before searching — the game, its series and its sets.
 * Never the cards (progressive disclosure).
 */
import { sql, type Db } from '@constellation/database'
import type { GraphNeighborhood } from '@constellation/domain'
import { rows, toGraphEdge, toGraphNode, type EdgeRow, type NodeRow } from './rows'

export async function getUniverse(db: Db, gameSlug: string): Promise<GraphNeighborhood | null> {
  const nodeRows = rows<NodeRow>(
    await db.execute(sql`
      select n.id, n.game_id, n.node_type, n.entity_id, n.label, n.subtitle, n.image_url, n.metadata
      from graph_nodes n
      join tcg_games g on g.id = n.game_id
      where g.slug = ${gameSlug} and n.node_type in ('game', 'series', 'set')
      order by case n.node_type when 'game' then 0 when 'series' then 1 else 2 end,
        coalesce(n.metadata->>'releaseDate', '9999') asc, n.label asc
    `),
  )
  const nodes = nodeRows.map(toGraphNode)
  const focus = nodes.find((n) => n.nodeType === 'game')
  if (!focus) return null

  const edgeRows = rows<EdgeRow>(
    await db.execute(sql`
      select e.id, e.source_node_id, e.target_node_id, e.relationship_type, e.weight, e.direction, e.metadata
      from graph_edges e
      join graph_nodes s on s.id = e.source_node_id
      join graph_nodes t on t.id = e.target_node_id
      join tcg_games g on g.id = s.game_id
      where g.slug = ${gameSlug}
        and s.node_type in ('series', 'set') and t.node_type in ('game', 'series')
    `),
  )
  const edges = edgeRows.map(toGraphEdge)
  const distances: Record<string, number> = {}
  for (const node of nodes) {
    distances[node.id] = node.nodeType === 'game' ? 0 : node.nodeType === 'series' ? 1 : 2
  }
  return {
    focus,
    nodes,
    edges,
    meta: {
      depth: 2,
      truncated: false,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      distances,
    },
  }
}
