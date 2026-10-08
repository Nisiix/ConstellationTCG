import 'server-only'
import { isConstellationError } from '@constellation/domain'
import { NextResponse } from 'next/server'

export const CACHE_PUBLIC = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'

export function json<T>(data: T, init: { status?: number; cache?: string } = {}): NextResponse {
  const response = NextResponse.json(data, { status: init.status ?? 200 })
  if (init.cache) response.headers.set('Cache-Control', init.cache)
  return response
}

export function errorResponse(error: unknown): NextResponse {
  if (isConstellationError(error)) {
    const status =
      typeof error.details.status === 'number'
        ? error.details.status
        : error.layer === 'validation'
          ? 400
          : 500
    return NextResponse.json(
      { error: { layer: error.layer, message: error.message, details: safeDetails(error.details) } },
      { status },
    )
  }
  console.error(error)
  return NextResponse.json(
    { error: { layer: 'unknown', message: 'Unexpected server error' } },
    { status: 500 },
  )
}

function safeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const { status: _status, ...rest } = details
  return rest
}

export { filterParams, intParam, listParam } from '@/lib/params'
