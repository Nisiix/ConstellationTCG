import type { NextRequest } from 'next/server'
import { CACHE_PUBLIC, errorResponse, json, rateLimit } from '@/server/http'
import { DEFAULT_GAME, getFilterService } from '@/server/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  const startedAt = performance.now()
  try {
    const game = request.nextUrl.searchParams.get('game') ?? DEFAULT_GAME
    const service = await getFilterService()
    const filters = await service.definitions(game)
    return json({ game, filters }, { cache: CACHE_PUBLIC, startedAt })
  } catch (error) {
    return errorResponse(error)
  }
}
