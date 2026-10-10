/**
 * Universe view: what a visitor sees before searching — the game, its series and its sets,
 * most recent first. Never the cards (progressive disclosure).
 *
 * One sky, not a list: besides set → series → game, the strongest bridges between sets (the same
 * Pokémon, the same artists, a similar make-up; see `similarity.ts`) are part of the view, a few per
 * set, so kindred expansions gather across series and eras.
 */
import { sql, type Db } from '@constellation/database'
import type { GraphNeighborhood } from '@constellation/domain'
import { rows, toGraphEdge, toGraphNode, type EdgeRow, type NodeRow } from './rows'

/** Bridges kept per set in the universe (the strongest first, whatever their kind). */
export const UNIVERSE_BRIDGES_PER_SET = 3
const SET_BRIDGES = ['SHARED_SUBJECTS', 'SHARED_ARTISTS', 'SIMILAR_STRUCTURE']

export async function getUniverse(db: Db, gameSlug: string): Promise<GraphNeighborhood | null> {
  const nodeRows = rows<NodeRow>(
    await db.execute(sql`
      select n.id, n.game_id, n.node_type, n.entity_id, n.label, n.subtitle, n.image_url, n.metadata
      from graph_nodes n
      join tcg_games g on g.id = n.game_id
      where g.slug = ${gameSlug} and n.node_type in ('game', 'series', 'set')
      order by case n.node_type when 'game' then 0 when 'series' then 1 else 2 end,
        coalesce(n.metadata->>'releaseDate', '') desc, n.label asc
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
  // Each set keeps its strongest bridges; an edge is kept when it is among the best of either end.
  const bridgeRows = rows<EdgeRow>(
    await db.execute(sql`
      with bridges as (
        select e.id, e.source_node_id, e.target_node_id, e.relationship_type, e.weight, e.direction, e.metadata,
          coalesce((e.metadata->>'score')::float, e.weight) as score
        from graph_edges e
        join graph_nodes s on s.id = e.source_node_id
        join graph_nodes t on t.id = e.target_node_id
        join tcg_games g on g.id = s.game_id
        where g.slug = ${gameSlug} and s.node_type = 'set' and t.node_type = 'set'
          and e.relationship_type in (${sql.join(SET_BRIDGES.map((t) => sql`${t}`), sql`, `)})
      ), ends as (
        select id, source_node_id as set_id, score from bridges
        union all
        select id, target_node_id as set_id, score from bridges
      ), ranked as (
        select id, row_number() over (partition by set_id order by score desc, id) as rn from ends
      )
      select b.id, b.source_node_id, b.target_node_id, b.relationship_type, b.weight, b.direction, b.metadata
      from bridges b
      where b.id in (select id from ranked where rn <= ${UNIVERSE_BRIDGES_PER_SET})
      order by b.id
    `),
  )
  const edges = [...edgeRows, ...bridgeRows].map(toGraphEdge)
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
