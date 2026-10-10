import { getLandmarks, type Landmarks } from '@constellation/graph'
import { GraphError } from '@constellation/domain'
import type { NextRequest } from 'next/server'
import { getCache } from '@/server/cache'
import { getDatabase } from '@/server/db'
import { CACHE_PUBLIC, errorResponse, json, rateLimit } from '@/server/http'
import { DEFAULT_GAME } from '@/server/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** `GET /api/graph/landmarks?game=pokemon`: the landmarks of a game's sky, each with its reason. */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  const startedAt = performance.now()
  try {
    const game = request.nextUrl.searchParams.get('game') ?? DEFAULT_GAME
    const cache = getCache<Landmarks | null>('landmarks', 300_000, 20)
    const landmarks = await cache.getOrSet(game, async () => {
      const { db } = await getDatabase()
      return getLandmarks(db, game)
    })
    if (!landmarks) {
      throw new GraphError(`No landmarks for game "${game}". Run ingestion and the graph builder first.`, { status: 404, game })
    }
    return json(landmarks, { cache: CACHE_PUBLIC, startedAt })
  } catch (error) {
    return errorResponse(error)
  }
}
