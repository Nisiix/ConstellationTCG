import { getLineage, type Lineage } from '@constellation/graph'
import { GraphError, parseNodeId } from '@constellation/domain'
import type { NextRequest } from 'next/server'
import { getCache } from '@/server/cache'
import { getDatabase } from '@/server/db'
import { CACHE_PUBLIC, errorResponse, json, rateLimit } from '@/server/http'
import { getRegistry } from '@/server/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * `GET /api/graph/lineage/<node>`: the lineage of a Pokémon (or of the Pokémon a card shows; of
 * the card itself when it shows none): its evolution line, every printing by era, its artists.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ nodeId: string }> }) {
  const limited = rateLimit(request)
  if (limited) return limited
  const startedAt = performance.now()
  try {
    const { nodeId: rawId } = await context.params
    const nodeId = decodeURIComponent(rawId)
    if (!parseNodeId(nodeId)) throw new GraphError(`Invalid node id: ${nodeId}`, { status: 400 })
    const cache = getCache<Lineage>('lineage', 120_000, 200)
    const lineage = await cache.getOrSet(nodeId, async () => {
      const { db } = await getDatabase()
      const registry = getRegistry()
      return getLineage(db, nodeId, { subjectRelation: (slug) => registry.bySlug(slug)?.definition().subjectRelation ?? null })
    })
    return json(lineage, { cache: CACHE_PUBLIC, startedAt })
  } catch (error) {
    return errorResponse(error)
  }
}
