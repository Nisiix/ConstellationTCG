/**
 * The job queue of the catalog import (`catalog_import_jobs`).
 *
 * A run is one `plan` job, then one `set` job per set that changed at the source, then `graph`
 * jobs that rebuild the projection in bounded steps. Jobs are claimed one at a time with
 * `for update skip locked`, so several workers may tick at once; a job runs only when nothing of a
 * lower priority is still pending or running (plan → sets → graph steps in order). A worker that
 * went silent leaves its job `running`: after `staleAfterMs` it is claimed again, up to
 * `maxAttempts` in total. The SQL helpers (`catalog_import_request`, `_status`, `_retry_failed`)
 * live in the migration so pg_cron and the CLI share one implementation.
 */
import { catalogImportJobs, eq, rowsOf, sql, type Db } from '@constellation/database'
import type { GraphStep } from '@constellation/graph'

export type CatalogJob = typeof catalogImportJobs.$inferSelect
export type CatalogJobKind = 'plan' | 'set' | 'graph'
export type CatalogJobStatus = 'pending' | 'running' | 'done' | 'failed'

/** Lower runs first; a job runs only when no job of a lower priority is pending or running. */
export const JOB_PRIORITY = {
  plan: 0,
  set: 10,
  graph: { scaffold: 20, identities: 21, printings: 22, reprints: 23, similarity: 24, finish: 25 },
} as const

export const DEFAULT_STALE_MS = 10 * 60 * 1000
export const DEFAULT_MAX_ATTEMPTS = 3

export interface PlanJobPayload {
  /** Re-import every set instead of only the ones that changed at the source. */
  full?: boolean
}

export interface SetJobPayload {
  setExternalId: string
  setName: string
  cardsExpected: number | null
  releaseDate: string | null
}

export interface GraphJobPayload {
  buildId: string
  step: GraphStep
}

export interface NewCatalogJob {
  runId: string | null
  gameSlug: string
  kind: CatalogJobKind
  priority: number
  position: number
  setExternalId?: string | null
  payload: Record<string, unknown>
}

export interface CatalogImportStatus {
  game: string
  runId: string | null
  pending: number
  running: number
  done: number
  failed: number
  setsTotal: number
  setsDone: number
  cardsExpected: number
  cardsImported: number
  graphPending: number
  lastError: string | null
  startedAt: string | null
  updatedAt: string | null
  /** No job pending or running (the run is over, with or without failures). */
  finished: boolean
}

/** Ask for an import (idempotent while one is in progress). Returns the plan job id, or null. */
export async function requestCatalogImport(
  db: Db,
  gameSlug: string,
  options: { full?: boolean } = {},
): Promise<string | null> {
  const result = await db.execute(
    sql`select catalog_import_request(${gameSlug}::text, ${options.full ?? false}::boolean) as id`,
  )
  return rowsOf<{ id: string | null }>(result)[0]?.id ?? null
}

export interface ClaimOptions {
  /** Only jobs of this game (default: any game). */
  gameSlug?: string | null
  /** After this long a `running` job counts as abandoned and can be claimed again. */
  staleAfterMs?: number
}

/** Claim the next runnable job (marks it `running`, increments `attempts`). Null when idle. */
export async function claimNextCatalogJob(db: Db, options: ClaimOptions = {}): Promise<CatalogJob | null> {
  const stale = `${options.staleAfterMs ?? DEFAULT_STALE_MS} milliseconds`
  const game = options.gameSlug ?? null
  const result = await db.execute(sql`
    with candidate as (
      select j.id from catalog_import_jobs j
      where (${game}::text is null or j.game_slug = ${game}::text)
        and (j.status = 'pending' or (j.status = 'running' and j.claimed_at < now() - ${stale}::interval))
        and not exists (
          select 1 from catalog_import_jobs o
          where o.game_slug = j.game_slug and o.priority < j.priority
            and (o.status = 'pending' or (o.status = 'running' and o.claimed_at >= now() - ${stale}::interval))
        )
      order by j.priority, j.position, j.created_at
      limit 1
      for update skip locked
    )
    update catalog_import_jobs j
      set status = 'running', claimed_at = now(), attempts = j.attempts + 1, updated_at = now()
      from candidate
      where j.id = candidate.id
      returning j.*
  `)
  const [row] = rowsOf<Record<string, unknown>>(result)
  return row ? toJob(row) : null
}

export async function completeCatalogJob(
  db: Db,
  jobId: string,
  result: Record<string, unknown>,
  ingestionRunId?: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  await db
    .update(catalogImportJobs)
    .set({
      status: 'done',
      result,
      error: null,
      finishedAt: now,
      updatedAt: now,
      ...(ingestionRunId ? { ingestionRunId } : {}),
    })
    .where(eq(catalogImportJobs.id, jobId))
}

/** Record a failure: back to `pending` for another attempt, or `failed` for good. */
export async function failCatalogJob(
  db: Db,
  job: CatalogJob,
  error: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<'retry' | 'failed'> {
  const outcome = job.attempts >= maxAttempts ? 'failed' : 'retry'
  const now = new Date().toISOString()
  await db
    .update(catalogImportJobs)
    .set({
      status: outcome === 'failed' ? 'failed' : 'pending',
      error,
      finishedAt: outcome === 'failed' ? now : null,
      updatedAt: now,
    })
    .where(eq(catalogImportJobs.id, job.id))
  return outcome
}

const INSERT_CHUNK = 400

export async function enqueueCatalogJobs(db: Db, jobs: NewCatalogJob[]): Promise<void> {
  for (let i = 0; i < jobs.length; i += INSERT_CHUNK) {
    await db.insert(catalogImportJobs).values(
      jobs.slice(i, i + INSERT_CHUNK).map((j) => ({
        runId: j.runId,
        gameSlug: j.gameSlug,
        kind: j.kind,
        priority: j.priority,
        position: j.position,
        setExternalId: j.setExternalId ?? null,
        payload: j.payload,
      })),
    )
  }
}

export async function getCatalogImportStatus(db: Db, gameSlug: string): Promise<CatalogImportStatus> {
  const result = await db.execute(sql`select catalog_import_status(${gameSlug}::text) as status`)
  const raw = rowsOf<{ status: unknown }>(result)[0]?.status
  const s = (typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)) ?? {}
  const n = (key: string) => Number(s[key] ?? 0)
  const t = (key: string) => {
    const v = s[key]
    return typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : null
  }
  return {
    game: gameSlug,
    runId: typeof s.runId === 'string' ? s.runId : null,
    pending: n('pending'),
    running: n('running'),
    done: n('done'),
    failed: n('failed'),
    setsTotal: n('setsTotal'),
    setsDone: n('setsDone'),
    cardsExpected: n('cardsExpected'),
    cardsImported: n('cardsImported'),
    graphPending: n('graphPending'),
    lastError: typeof s.lastError === 'string' ? s.lastError : null,
    startedAt: t('startedAt'),
    updatedAt: t('updatedAt'),
    finished: s.finished === true || s.finished === 't',
  }
}

/** Failed jobs of the latest run, with their errors. */
export async function listFailedCatalogJobs(
  db: Db,
  gameSlug: string,
): Promise<Array<{ id: string; kind: string; setExternalId: string | null; attempts: number; error: string | null }>> {
  return rowsOf<{ id: string; kind: string; set_external_id: string | null; attempts: number; error: string | null }>(
    await db.execute(sql`
      select id, kind, set_external_id, attempts, error from catalog_import_jobs
      where game_slug = ${gameSlug}::text and status = 'failed'
        and run_id = (select id from catalog_import_jobs where game_slug = ${gameSlug}::text and kind = 'plan' order by created_at desc limit 1)
      order by priority, position`),
  ).map((r) => ({ id: r.id, kind: r.kind, setExternalId: r.set_external_id, attempts: Number(r.attempts), error: r.error }))
}

/** Forget the finished runs older than `days` (the plan job calls this; the queue is a log, not an archive). */
export async function pruneCatalogImportJobs(db: Db, gameSlug: string, days = 30): Promise<void> {
  await db.execute(sql`
    delete from catalog_import_jobs
    where game_slug = ${gameSlug}::text and status in ('done', 'failed')
      and created_at < now() - ${`${days} days`}::interval
      and run_id <> (select id from catalog_import_jobs where game_slug = ${gameSlug}::text and kind = 'plan' order by created_at desc limit 1)`)
}

/** Put the failed jobs of the latest run back in the queue. Returns how many. */
export async function retryFailedCatalogJobs(db: Db, gameSlug: string): Promise<number> {
  const result = await db.execute(sql`select catalog_import_retry_failed(${gameSlug}::text) as n`)
  return Number(rowsOf<{ n: number | string }>(result)[0]?.n ?? 0)
}

// ───────────────────────────── rows ─────────────────────────────

function toJob(r: Record<string, unknown>): CatalogJob {
  return {
    id: String(r.id),
    runId: (r.run_id as string | null) ?? null,
    gameSlug: String(r.game_slug),
    kind: String(r.kind),
    status: String(r.status),
    priority: Number(r.priority),
    position: Number(r.position),
    attempts: Number(r.attempts),
    setExternalId: (r.set_external_id as string | null) ?? null,
    payload: json(r.payload),
    result: json(r.result),
    error: (r.error as string | null) ?? null,
    ingestionRunId: (r.ingestion_run_id as string | null) ?? null,
    claimedAt: iso(r.claimed_at),
    finishedAt: iso(r.finished_at),
    createdAt: iso(r.created_at) ?? new Date().toISOString(),
    updatedAt: iso(r.updated_at) ?? new Date().toISOString(),
  }
}

function json(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return value as Record<string, unknown>
}

function iso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}
