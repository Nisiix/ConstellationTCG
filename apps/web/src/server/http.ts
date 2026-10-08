import 'server-only'
import { isConstellationError } from '@constellation/domain'
import { NextResponse } from 'next/server'

/** Short browser cache; CDNs may hold responses longer (data only changes with ingestion). */
export const CACHE_PUBLIC = 'public, max-age=30, s-maxage=300, stale-while-revalidate=60'

export function json<T>(data: T, init: { status?: number; cache?: string; startedAt?: number } = {}): NextResponse {
  const response = NextResponse.json(data, { status: init.status ?? 200 })
  if (init.cache) response.headers.set('Cache-Control', init.cache)
  // Observability: how long the server spent, readable in the browser's network panel.
  if (init.startedAt !== undefined) response.headers.set('Server-Timing', `app;dur=${(performance.now() - init.startedAt).toFixed(1)}`)
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
export { rateLimit } from './rate-limit'
