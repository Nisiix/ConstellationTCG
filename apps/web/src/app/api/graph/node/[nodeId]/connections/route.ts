import { getConnections, getNode } from '@constellation/graph'
import { GraphError, NODE_TYPES, parseNodeId, type NodeType } from '@constellation/domain'
import type { NextRequest } from 'next/server'
import { getCache } from '@/server/cache'
import { getDatabase } from '@/server/db'
import { resolveGraphFilters } from '@/server/graph-filters'
import { CACHE_PUBLIC, errorResponse, filterParams, intParam, json, listParam, rateLimit } from '@/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Every connection of one kind of a node, a page at a time: what a "Show all" page lists.
 * `?rel=BELONGS_TO&dir=in&offset=0&limit=60`, plus the explorer's node types and filters.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ nodeId: string }> }) {
  const limited = rateLimit(request)
  if (limited) return limited
  const startedAt = performance.now()
  try {
    const { nodeId: rawId } = await context.params
    const nodeId = decodeURIComponent(rawId)
    if (!parseNodeId(nodeId)) throw new GraphError(`Invalid node id: ${nodeId}`, { status: 400 })
    const params = request.nextUrl.searchParams
    const relationshipType = params.get('rel') ?? ''
    const direction = params.get('dir')
    if (!/^[A-Z][A-Z_]{0,63}$/.test(relationshipType)) throw new GraphError('Invalid relationship type', { status: 400 })
    if (direction !== 'out' && direction !== 'in') throw new GraphError('Direction must be out or in', { status: 400 })
    const offset = intParam(params.get('offset'), 0, 0, 100_000)
    const limit = intParam(params.get('limit'), 60, 1, 200)
    const nodeTypes = (listParam(params.get('nodeTypes')) ?? []).filter((t): t is NodeType => (NODE_TYPES as readonly string[]).includes(t))
    const rawFilters = filterParams(params)

    const cache = getCache<unknown>('connections', 120_000, 300)
    const key = JSON.stringify([nodeId, relationshipType, direction, offset, limit, nodeTypes, rawFilters])
    const response = await cache.getOrSet(key, async () => {
      const database = await getDatabase()
      const db = database.db
      const node = await getNode(db, nodeId)
      if (!node) throw new GraphError(`Node not found: ${nodeId}`, { status: 404, nodeId })
      const filters = await resolveGraphFilters(db, nodeId, rawFilters, { relationshipTypes: null, nodeTypes })
      const page = await getConnections(db, nodeId, {
        relationshipType,
        direction,
        offset,
        limit,
        nodeTypes: filters.nodeTypes.length ? filters.nodeTypes : null,
        allowedPrintingNodeIds: filters.allowedPrintingNodeIds,
      })
      return { node, relationshipType, direction, offset, total: page.total, items: page.items, filtered: filters.allowedPrintingNodeIds !== null }
    })
    return json(response, { cache: CACHE_PUBLIC, startedAt })
  } catch (error) {
    return errorResponse(error)
  }
}
