import 'server-only'
import { ValidationError, isConstellationError } from '@constellation/domain'
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

/** The JSON body of a request as an object; a 400 `ValidationError` when it is not one. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ValidationError('Expected a JSON body', { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Expected a JSON object', { status: 400 })
  return body as Record<string, unknown>
}

/** A required string field of a JSON body, trimmed and bounded. */
export function stringField(body: Record<string, unknown>, key: string, options: { required?: boolean; max?: number } = {}): string | null {
  const value = body[key]
  if (value === undefined || value === null || value === '') {
    if (options.required) throw new ValidationError(`Missing field: ${key}`, { status: 400, field: key })
    return null
  }
  if (typeof value !== 'string') throw new ValidationError(`Field ${key} must be a string`, { status: 400, field: key })
  const trimmed = value.trim()
  if (options.required && !trimmed) throw new ValidationError(`Missing field: ${key}`, { status: 400, field: key })
  return trimmed.slice(0, options.max ?? 500)
}

function safeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const { status: _status, ...rest } = details
  return rest
}

export { filterParams, intParam, listParam } from '@/lib/params'
export { rateLimit } from './rate-limit'
