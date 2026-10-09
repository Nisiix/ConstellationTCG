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
import { resolveGraphFilters } from '@/server/graph-filters'
import { CACHE_PUBLIC, errorResponse, filterParams, intParam, json, listParam, rateLimit } from '@/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface FocusResponse extends GraphNeighborhood {
  summary: RelationshipSummary[]
  filtered: boolean
}

export async function GET(request: NextRequest, context: { params: Promise<{ nodeId: string }> }) {
  const limited = rateLimit(request)
  if (limited) return limited
  const startedAt = performance.now()
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

      const resolved = await resolveGraphFilters(db, nodeId, rawFilters, { relationshipTypes, nodeTypes })
      const allowedPrintingNodeIds = resolved.allowedPrintingNodeIds
      const graphRelationshipTypes = resolved.relationshipTypes
      const graphNodeTypes = resolved.nodeTypes
      const effectiveDepth = resolved.depth !== null && !params.get('depth') ? resolved.depth : depth

      const [neighborhood, summary] = await Promise.all([
        getNeighborhood(db, nodeId, {
          depth: effectiveDepth,
          limit,
          perNodeLimit,
          relationshipTypes: graphRelationshipTypes,
          nodeTypes: graphNodeTypes.length ? graphNodeTypes : null,
          allowedPrintingNodeIds,
        }),
        getRelationshipSummary(db, nodeId, {
          nodeTypes: graphNodeTypes.length ? graphNodeTypes : null,
          relationshipTypes: graphRelationshipTypes,
        }),
      ])
      return { ...neighborhood, summary, filtered: allowedPrintingNodeIds !== null }
    })
    return json(response, { cache: CACHE_PUBLIC, startedAt })
  } catch (error) {
    return errorResponse(error)
  }
}
