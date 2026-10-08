import { sql } from '@constellation/database'
import { matchingPrintingNodeIds, parseSelection } from '@constellation/filters'
import { getNeighborhood, getRelationshipSummary } from '@constellation/graph'
import {
  GraphError,
  MAX_GRAPH_DEPTH,
  NODE_TYPES,
  parseNodeId,
  type GraphNeighborhood,
  type NodeType,
  type RelationshipSummary,
} from '@constellation/domain'
import type { NextRequest } from 'next/server'
import { getCache } from '@/server/cache'
import { getDatabase } from '@/server/db'
import { CACHE_PUBLIC, errorResponse, filterParams, intParam, json, listParam } from '@/server/http'
import { getFilterService } from '@/server/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface FocusResponse extends GraphNeighborhood {
  summary: RelationshipSummary[]
  filtered: boolean
}

export async function GET(request: NextRequest, context: { params: Promise<{ nodeId: string }> }) {
  try {
    const { nodeId: rawId } = await context.params
    const nodeId = decodeURIComponent(rawId)
    if (!parseNodeId(nodeId)) throw new GraphError(`Invalid node id: ${nodeId}`, { status: 400 })

    const params = request.nextUrl.searchParams
    const depth = intParam(params.get('depth'), 1, 0, MAX_GRAPH_DEPTH)
    const limit = intParam(params.get('limit'), 300, 1, 1000)
    const perNodeLimit = intParam(params.get('perNode'), 60, 1, 500)
    const relationshipTypes = listParam(params.get('relationshipTypes'))
    const nodeTypes = (listParam(params.get('nodeTypes')) ?? []).filter((t): t is NodeType =>
      (NODE_TYPES as readonly string[]).includes(t),
    )
    const rawFilters = filterParams(params)

    const cache = getCache<FocusResponse>('focus', 120_000, 500)
    const key = JSON.stringify([nodeId, depth, limit, perNodeLimit, relationshipTypes, nodeTypes, rawFilters])
    const response = await cache.getOrSet(key, async () => {
      const database = await getDatabase()
      const db = database.db

      let allowedPrintingNodeIds: Set<string> | null = null
      let graphRelationshipTypes = relationshipTypes
      let graphNodeTypes: NodeType[] = nodeTypes
      let effectiveDepth = depth

      if (Object.keys(rawFilters).length > 0) {
        const gameRow = await db.execute(
          sql`select g.id, g.slug from graph_nodes n join tcg_games g on g.id = n.game_id where n.id = ${nodeId}`,
        )
        const games = Array.isArray(gameRow) ? gameRow : (gameRow as { rows: unknown[] }).rows
        const game = games[0] as { id: string; slug: string } | undefined
        if (game) {
          const filters = await getFilterService()
          const definitions = await filters.definitions(game.slug)
          const selection = parseSelection(definitions, rawFilters)
          allowedPrintingNodeIds = await matchingPrintingNodeIds(db, game.id, definitions, selection)
          const rel = selection.relationship
          if (Array.isArray(rel) && rel.length && !graphRelationshipTypes) graphRelationshipTypes = rel as string[]
          const types = selection.nodeType
          if (Array.isArray(types) && types.length && graphNodeTypes.length === 0) {
            graphNodeTypes = (types as string[]).filter((t): t is NodeType =>
              (NODE_TYPES as readonly string[]).includes(t),
            )
          }
          const range = selection.graphDepth
          if (Array.isArray(range) && typeof range[1] === 'number' && !params.get('depth')) {
            effectiveDepth = Math.min(MAX_GRAPH_DEPTH, Math.max(0, range[1]))
          }
        }
      }

      const [neighborhood, summary] = await Promise.all([
        getNeighborhood(db, nodeId, {
          depth: effectiveDepth,
          limit,
          perNodeLimit,
          relationshipTypes: graphRelationshipTypes,
          nodeTypes: graphNodeTypes.length ? graphNodeTypes : null,
          allowedPrintingNodeIds,
        }),
        getRelationshipSummary(db, nodeId),
      ])
      return { ...neighborhood, summary, filtered: allowedPrintingNodeIds !== null }
    })
    return json(response, { cache: CACHE_PUBLIC })
  } catch (error) {
    return errorResponse(error)
  }
}
