import { getNode, getRelationshipSummary } from '@constellation/graph'
import { GraphError, parseNodeId } from '@constellation/domain'
import type { NextRequest } from 'next/server'
import { getDatabase } from '@/server/db'
import { CACHE_PUBLIC, errorResponse, json, rateLimit } from '@/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ nodeId: string }> }) {
  const limited = rateLimit(request)
  if (limited) return limited
  const startedAt = performance.now()
  try {
    const { nodeId: rawId } = await context.params
    const nodeId = decodeURIComponent(rawId)
    if (!parseNodeId(nodeId)) throw new GraphError(`Invalid node id: ${nodeId}`, { status: 400 })
    const database = await getDatabase()
    const [node, summary] = await Promise.all([
      getNode(database.db, nodeId),
      getRelationshipSummary(database.db, nodeId),
    ])
    if (!node) throw new GraphError(`Node not found: ${nodeId}`, { status: 404, nodeId })
    return json({ node, summary }, { cache: CACHE_PUBLIC, startedAt })
  } catch (error) {
    return errorResponse(error)
  }
}
