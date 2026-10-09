import 'server-only'
import { sql, type Db } from '@constellation/database'
import { matchingPrintingNodeIds, parseSelection } from '@constellation/filters'
import { MAX_GRAPH_DEPTH, NODE_TYPES, type NodeType } from '@constellation/domain'
import { getFilterService } from './registry'

export interface GraphFilters {
  /** Only these printings may appear; null = no printing filter. */
  allowedPrintingNodeIds: Set<string> | null
  relationshipTypes: string[] | null
  nodeTypes: NodeType[]
  /** The depth a graph-depth filter asks for, when it asks. */
  depth: number | null
}

/**
 * The URL's filters (`f.*`) for the game a node belongs to, read the way every graph route reads
 * them: printing filters become the set of printings allowed; relationship and node type filters
 * apply unless the request named its own.
 */
export async function resolveGraphFilters(
  db: Db,
  nodeId: string,
  rawFilters: Record<string, string>,
  requested: { relationshipTypes: string[] | null; nodeTypes: NodeType[] },
): Promise<GraphFilters> {
  const out: GraphFilters = {
    allowedPrintingNodeIds: null,
    relationshipTypes: requested.relationshipTypes,
    nodeTypes: requested.nodeTypes,
    depth: null,
  }
  if (Object.keys(rawFilters).length === 0) return out
  const gameRow = await db.execute(sql`select g.id, g.slug from graph_nodes n join tcg_games g on g.id = n.game_id where n.id = ${nodeId}`)
  const games = Array.isArray(gameRow) ? gameRow : (gameRow as { rows: unknown[] }).rows
  const game = games[0] as { id: string; slug: string } | undefined
  if (!game) return out
  const filters = await getFilterService()
  const definitions = await filters.definitions(game.slug)
  const selection = parseSelection(definitions, rawFilters)
  out.allowedPrintingNodeIds = await matchingPrintingNodeIds(db, game.id, definitions, selection)
  const rel = selection.relationship
  if (Array.isArray(rel) && rel.length && !out.relationshipTypes) out.relationshipTypes = rel as string[]
  const types = selection.nodeType
  if (Array.isArray(types) && types.length && out.nodeTypes.length === 0) {
    out.nodeTypes = (types as string[]).filter((t): t is NodeType => (NODE_TYPES as readonly string[]).includes(t))
  }
  const range = selection.graphDepth
  if (Array.isArray(range) && typeof range[1] === 'number') out.depth = Math.min(MAX_GRAPH_DEPTH, Math.max(0, range[1]))
  return out
}
