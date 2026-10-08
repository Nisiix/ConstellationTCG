import { NODE_TYPES, type NodeType } from '@constellation/domain'
import { search, type SearchHit } from '@constellation/search'
import type { NextRequest } from 'next/server'
import { getCache } from '@/server/cache'
import { getDatabase } from '@/server/db'
import { CACHE_PUBLIC, errorResponse, intParam, json, listParam } from '@/server/http'
import { DEFAULT_GAME } from '@/server/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const q = (params.get('q') ?? '').slice(0, 120)
    const game = params.get('game') ?? DEFAULT_GAME
    const types = (listParam(params.get('type')) ?? []).filter((t): t is NodeType =>
      (NODE_TYPES as readonly string[]).includes(t),
    )
    const limit = intParam(params.get('limit'), 20, 1, 50)
    if (!q.trim()) return json({ results: [] as SearchHit[] }, { cache: CACHE_PUBLIC })

    const cache = getCache<SearchHit[]>('search', 60_000, 1000)
    const key = `${game}|${types.join(',')}|${limit}|${q.toLowerCase()}`
    const results = await cache.getOrSet(key, async () => {
      const database = await getDatabase()
      return search(database.db, { q, game, types: types.length ? types : null, limit })
    })
    return json({ results }, { cache: CACHE_PUBLIC })
  } catch (error) {
    return errorResponse(error)
  }
}
