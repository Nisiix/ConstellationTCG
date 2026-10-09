import { getPath, PATH_DEFAULT_DEPTH, PATH_MAX_DEPTH, type GraphPath } from '@constellation/graph'
import type { NextRequest } from 'next/server'
import { ValidationError } from '@constellation/domain'
import { getCache } from '@/server/cache'
import { getDatabase } from '@/server/db'
import { CACHE_PUBLIC, errorResponse, intParam, json, rateLimit } from '@/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * `GET /api/graph/path?from=<node>&to=<node>[&max=8]`: the shortest path between two points, over
 * the fixed bridges (cards, printings, sets, series, artists). 200 with `found: false` when there
 * is none within `max` steps (6 by default, 8 at most).
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  const startedAt = performance.now()
  try {
    const params = request.nextUrl.searchParams
    const from = params.get('from')?.trim()
    const to = params.get('to')?.trim()
    if (!from || !to) throw new ValidationError('Both ends are required: ?from=<node>&to=<node>', { status: 400 })
    const maxDepth = intParam(params.get('max'), PATH_DEFAULT_DEPTH, 1, PATH_MAX_DEPTH)
    const cache = getCache<GraphPath>('path', 120_000, 500)
    const response = await cache.getOrSet(JSON.stringify([from, to, maxDepth]), async () => {
      const { db } = await getDatabase()
      return getPath(db, from, to, { maxDepth })
    })
    return json(response, { cache: CACHE_PUBLIC, startedAt })
  } catch (error) {
    return errorResponse(error)
  }
}
