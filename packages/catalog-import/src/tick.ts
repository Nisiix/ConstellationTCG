/**
 * One tick = claim the next runnable job and run it to completion.
 *
 *   plan   refresh the series, list the sets at the source, queue a `set` job for every set that
 *          changed (or every set for a full import) and the first graph step
 *   set    the ingestion pipeline for one set (series reused from the database)
 *   graph  one step of the resumable projection build; the scaffold step queues the others
 *
 * A failing job goes back to the queue up to `maxAttempts`, then stays `failed` with its error.
 * Ingestion errors of single records never fail a job: they go to `ingestion_errors` as always.
 */
import { contentHash, type AdapterRegistry } from '@constellation/adapters'
import { eq, rowsOf, sql, tcgGames, tcgSets, type Database } from '@constellation/database'
import type { SourceType, TCGAdapter } from '@constellation/domain'
import { describeGraphStep, planGraphBuild, runGraphStep } from '@constellation/graph'
import { runIngestion } from '@constellation/ingestion'
import {
  claimNextCatalogJob,
  completeCatalogJob,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_STALE_MS,
  enqueueCatalogJobs,
  failCatalogJob,
  JOB_PRIORITY,
  pruneCatalogImportJobs,
  type CatalogJob,
  type GraphJobPayload,
  type NewCatalogJob,
  type PlanJobPayload,
  type SetJobPayload,
} from './jobs'

export interface CatalogImportRuntime {
  database: Database
  registry: AdapterRegistry
  source: { name: string; type: SourceType; baseUrl?: string | null; version?: string | null }
  /** Only jobs of this game (default: any game with a registered adapter). */
  gameSlug?: string | null
  maxAttempts?: number
  staleAfterMs?: number
  log?: (message: string) => void
}

export type TickResult =
  | { idle: true }
  | {
      idle: false
      job: CatalogJob
      outcome: 'done' | 'retry' | 'failed'
      durationMs: number
      detail: Record<string, unknown>
      error?: string
    }

interface JobOutcome {
  result: Record<string, unknown>
  ingestionRunId?: string | null
}

export async function runCatalogImportTick(rt: CatalogImportRuntime): Promise<TickResult> {
  const db = rt.database.db
  const log = rt.log ?? (() => {})
  const maxAttempts = rt.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const job = await claimNextCatalogJob(db, { gameSlug: rt.gameSlug ?? null, staleAfterMs: rt.staleAfterMs ?? DEFAULT_STALE_MS })
  if (!job) return { idle: true }
  const started = Date.now()
  log(`job ${job.kind}${job.setExternalId ? ` ${job.setExternalId}` : ''} (attempt ${job.attempts})`)

  if (job.attempts > maxAttempts) {
    // Claimed again and again by workers that died before recording a failure.
    const error = `gave up after ${job.attempts - 1} attempts without a result`
    await failCatalogJob(db, job, error, 0)
    return { idle: false, job, outcome: 'failed', durationMs: Date.now() - started, detail: {}, error }
  }

  try {
    const outcome = await runJob(rt, job)
    await completeCatalogJob(db, job.id, outcome.result, outcome.ingestionRunId)
    return { idle: false, job, outcome: 'done', durationMs: Date.now() - started, detail: outcome.result }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const outcome = await failCatalogJob(db, job, message, maxAttempts)
    log(`job ${job.kind} ${outcome}: ${message}`)
    return { idle: false, job, outcome, durationMs: Date.now() - started, detail: {}, error: message }
  }
}

async function runJob(rt: CatalogImportRuntime, job: CatalogJob): Promise<JobOutcome> {
  const adapter = rt.registry.bySlug(job.gameSlug)
  if (!adapter) throw new Error(`no adapter registered for game "${job.gameSlug}"`)
  switch (job.kind) {
    case 'plan':
      return runPlan(rt, adapter, job)
    case 'set':
      return runSet(rt, adapter, job)
    case 'graph':
      return runGraph(rt, adapter, job)
    default:
      throw new Error(`unknown job kind "${job.kind}"`)
  }
}

// ───────────────────────────── plan ─────────────────────────────

async function runPlan(rt: CatalogImportRuntime, adapter: TCGAdapter, job: CatalogJob): Promise<JobOutcome> {
  const db = rt.database.db
  const payload = job.payload as PlanJobPayload
  const full = payload.full === true
  await pruneCatalogImportJobs(db, job.gameSlug)

  // Game, source and series rows. No set and no card: an empty set list imports series only.
  const series = await runIngestion({
    database: rt.database,
    adapter,
    mode: 'incremental',
    source: rt.source,
    setExternalIds: [],
    log: rt.log,
  })

  const sets = await adapter.listSets()
  const [game] = await db.select({ id: tcgGames.id }).from(tcgGames).where(eq(tcgGames.slug, job.gameSlug))
  if (!game) throw new Error(`game "${job.gameSlug}" missing after the series ingestion`)
  const stored = new Map(
    (await db.select({ externalId: tcgSets.externalId, rawHash: tcgSets.rawHash }).from(tcgSets).where(eq(tcgSets.gameId, game.id))).map(
      (s) => [s.externalId, s.rawHash],
    ),
  )
  const printingCounts = new Map(
    rowsOf<{ external_id: string; n: number | string }>(
      await db.execute(sql`
        select s.external_id, count(p.id)::int as n from tcg_sets s
        left join card_printings p on p.set_id = s.id
        where s.game_id = ${game.id} group by s.external_id`),
    ).map((r) => [r.external_id, Number(r.n)]),
  )

  // A set is imported when it is new, when its source record changed (same hash as the pipeline
  // stores) or when fewer cards are stored than the source announces.
  const changed = sets.filter((set) => {
    if (full) return true
    const hash = stored.get(set.externalId)
    if (!hash || hash !== contentHash(set)) return true
    return set.cardCountTotal !== null && (printingCounts.get(set.externalId) ?? 0) < set.cardCountTotal
  })
  changed.sort(
    (a, b) => (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999') || a.externalId.localeCompare(b.externalId),
  )

  const runId = job.runId ?? job.id
  const jobs: NewCatalogJob[] = changed.map((set, position) => {
    const setPayload: SetJobPayload = {
      setExternalId: set.externalId,
      setName: set.name,
      cardsExpected: set.cardCountTotal,
      releaseDate: set.releaseDate,
    }
    return {
      runId,
      gameSlug: job.gameSlug,
      kind: 'set',
      priority: JOB_PRIORITY.set,
      position,
      setExternalId: set.externalId,
      payload: { ...setPayload },
    }
  })
  const rebuildGraph = jobs.length > 0 || full
  if (rebuildGraph) {
    const graphPayload: GraphJobPayload = { buildId: crypto.randomUUID(), step: { kind: 'scaffold' } }
    jobs.push({
      runId,
      gameSlug: job.gameSlug,
      kind: 'graph',
      priority: JOB_PRIORITY.graph.scaffold,
      position: 0,
      payload: { ...graphPayload },
    })
  }
  await enqueueCatalogJobs(db, jobs)
  return {
    result: {
      full,
      setsAtSource: sets.length,
      setsQueued: changed.length,
      graphQueued: rebuildGraph,
      series: { created: series.series.created, updated: series.series.updated, unchanged: series.series.unchanged, failed: series.series.failed },
    },
    ingestionRunId: series.runId,
  }
}

// ───────────────────────────── set ─────────────────────────────

async function runSet(rt: CatalogImportRuntime, adapter: TCGAdapter, job: CatalogJob): Promise<JobOutcome> {
  const payload = job.payload as Partial<SetJobPayload>
  const setExternalId = payload.setExternalId ?? job.setExternalId
  if (!setExternalId) throw new Error('set job without a set id')
  const report = await runIngestion({
    database: rt.database,
    adapter,
    mode: 'incremental',
    source: rt.source,
    setExternalIds: [setExternalId],
    refreshSeries: false,
    log: rt.log,
  })
  return {
    result: {
      set: setExternalId,
      status: report.status,
      seen: report.cards.seen,
      created: report.cards.created,
      updated: report.cards.updated,
      unchanged: report.cards.unchanged,
      failed: report.cards.failed,
      errors: report.errors,
      durationMs: report.durationMs,
    },
    ingestionRunId: report.runId,
  }
}

// ───────────────────────────── graph ─────────────────────────────

async function runGraph(rt: CatalogImportRuntime, adapter: TCGAdapter, job: CatalogJob): Promise<JobOutcome> {
  const db = rt.database.db
  const payload = job.payload as Partial<GraphJobPayload>
  if (!payload.buildId || !payload.step) throw new Error('graph job without a build id or a step')
  const [game] = await db.select({ id: tcgGames.id }).from(tcgGames).where(eq(tcgGames.slug, job.gameSlug))
  if (!game) throw new Error(`game "${job.gameSlug}" not found`)

  const report = await runGraphStep({
    database: rt.database,
    adapter,
    gameId: game.id,
    buildId: payload.buildId,
    step: payload.step,
    log: rt.log,
  })
  const result: Record<string, unknown> = {
    step: describeGraphStep(payload.step),
    nodes: report.nodes,
    edges: report.edges,
    skippedEdges: report.skippedEdges,
    deletedNodes: report.deletedNodes,
    deletedEdges: report.deletedEdges,
  }

  if (payload.step.kind === 'scaffold') {
    // The scaffold knows the catalog's size: queue the remaining steps in order.
    const steps = await planGraphBuild(db, game.id)
    const positions: Record<string, number> = {}
    const jobs: NewCatalogJob[] = steps.map((step) => {
      const position = positions[step.kind] ?? 0
      positions[step.kind] = position + 1
      const stepPayload: GraphJobPayload = { buildId: payload.buildId as string, step }
      return {
        runId: job.runId,
        gameSlug: job.gameSlug,
        kind: 'graph',
        priority: JOB_PRIORITY.graph[step.kind],
        position,
        payload: { ...stepPayload },
      }
    })
    await enqueueCatalogJobs(db, jobs)
    result.stepsQueued = steps.length
  }
  return { result }
}
