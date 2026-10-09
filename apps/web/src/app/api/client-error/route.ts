import type { NextRequest } from 'next/server'
import { errorResponse, json, rateLimit, readJson, stringField } from '@/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Client crashes, reported by the page itself: message, where, and which page. Written to the
 * server log so a deployment's logs show them next to server errors. No person-identifying data is
 * accepted or stored; bodies are trimmed and rate limited like every route.
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const body = await readJson(request)
    const report = {
      kind: stringField(body, 'kind', { max: 40 }) ?? 'error',
      message: stringField(body, 'message', { required: true, max: 500 }),
      source: stringField(body, 'source', { max: 300 }),
      page: stringField(body, 'page', { max: 300 }),
      stack: stringField(body, 'stack', { max: 1500 }),
      webgl: typeof body.webgl === 'boolean' ? body.webgl : null,
    }
    console.error('[client]', JSON.stringify(report))
    return json({ ok: true }, { status: 202, cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
