import { getUniverse } from '@constellation/graph'
import { GraphError, type GraphNeighborhood } from '@constellation/domain'
import type { NextRequest } from 'next/server'
import { getCache } from '@/server/cache'
import { getDatabase } from '@/server/db'
import { CACHE_PUBLIC, errorResponse, json, rateLimit } from '@/server/http'
import { DEFAULT_GAME } from '@/server/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  const startedAt = performance.now()
  try {
    const game = request.nextUrl.searchParams.get('game') ?? DEFAULT_GAME
    const cache = getCache<GraphNeighborhood | null>('universe', 120_000, 20)
    const universe = await cache.getOrSet(game, async () => {
      const database = await getDatabase()
      return getUniverse(database.db, game)
    })
    if (!universe) {
      throw new GraphError(`No universe for game "${game}". Run ingestion and the graph builder first.`, {
        status: 404,
        game,
      })
    }
    return json(universe, { cache: CACHE_PUBLIC, startedAt })
  } catch (error) {
    return errorResponse(error)
  }
}
