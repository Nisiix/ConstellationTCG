/**
 * HTTP face of the import, for a serverless worker (Supabase Edge Function) called by pg_cron:
 *
 *   POST /            run one tick (claim one job and finish it)      → { idle } | { job, outcome, … }
 *   POST / {request}  ask for an import ({ request: true, full?, game? }) → { requested: <plan id> }
 *   GET  /?game=      the status of the latest run                    → { status }
 *
 * Every call must present the shared token in `x-catalog-import-token` (or as a bearer token).
 * The token is generated inside the database (Vault) and read back by the worker, so it never
 * travels through anyone's hands. Framework-free (standard Request/Response) so it is unit-tested
 * here and deployed unchanged.
 */
import { getCatalogImportStatus, listFailedCatalogJobs, requestCatalogImport } from './jobs'
import { runCatalogImportTick, type CatalogImportRuntime } from './tick'

export interface CatalogImportHandlerOptions extends CatalogImportRuntime {
  /** The shared secret, or a function that reads it; null means "not configured" (503). */
  token: string | null | (() => Promise<string | null>)
  /** Return false to refuse new work for now (an ageing worker); the next tick retries. */
  acceptWork?: () => boolean
}

export async function handleCatalogImportRequest(request: Request, options: CatalogImportHandlerOptions): Promise<Response> {
  const token = typeof options.token === 'function' ? await options.token() : options.token
  if (!token) return json({ error: 'catalog import token not configured' }, 503)
  const presented = request.headers.get('x-catalog-import-token') ?? bearer(request.headers.get('authorization'))
  if (!presented || !safeEqual(presented, token)) return json({ error: 'unauthorized' }, 401)

  const url = new URL(request.url)
  const db = options.database.db
  const defaultGame = options.gameSlug ?? options.registry.list()[0]?.definition().slug ?? null

  if (request.method === 'GET') {
    const game = url.searchParams.get('game') ?? defaultGame
    if (!game) return json({ error: 'no game' }, 400)
    const [status, failures] = await Promise.all([getCatalogImportStatus(db, game), listFailedCatalogJobs(db, game)])
    return json({ status, failures })
  }
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await request.json().catch(() => ({}))) as { request?: boolean; full?: boolean; game?: string }
  if (body.request) {
    const game = body.game ?? defaultGame
    if (!game) return json({ error: 'no game' }, 400)
    const requested = await requestCatalogImport(db, game, { full: body.full === true })
    return json({ requested, status: await getCatalogImportStatus(db, game) })
  }
  if (options.acceptWork && !options.acceptWork()) {
    return json({ idle: true, reason: 'worker not accepting work' })
  }
  const result = await runCatalogImportTick({ ...options, gameSlug: body.game ?? options.gameSlug ?? null })
  if (result.idle) return json({ idle: true })
  return json({
    idle: false,
    job: {
      id: result.job.id,
      kind: result.job.kind,
      setExternalId: result.job.setExternalId,
      attempts: result.job.attempts,
      payload: result.job.payload,
    },
    outcome: result.outcome,
    durationMs: result.durationMs,
    detail: result.detail,
    ...(result.error ? { error: result.error } : {}),
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function bearer(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1] ?? null
}

/** Constant-time comparison of two short strings. */
function safeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  let diff = ab.length ^ bb.length
  const n = Math.max(ab.length, bb.length)
  for (let i = 0; i < n; i += 1) diff |= (ab[i % ab.length] ?? 0) ^ (bb[i % bb.length] ?? 0)
  return diff === 0
}
