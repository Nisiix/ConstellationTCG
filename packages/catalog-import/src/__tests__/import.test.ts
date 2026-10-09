import { createPokemonFixtureAdapter, PokemonAdapter, FixtureSource } from '@constellation/adapter-pokemon'
import { AdapterRegistry } from '@constellation/adapters'
import { catalogImportJobs, graphEdges, graphNodes, sql, type Database } from '@constellation/database'
import { buildGraphProjection } from '@constellation/graph'
import { createFixtureRegistry, createTestDatabase, FIXTURE_SOURCE } from '@constellation/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { handleCatalogImportRequest } from '../handler'
import {
  claimNextCatalogJob,
  getCatalogImportStatus,
  listFailedCatalogJobs,
  requestCatalogImport,
  retryFailedCatalogJobs,
} from '../jobs'
import { runCatalogImportTick, type TickResult } from '../tick'

const open: Database[] = []

async function fresh(): Promise<Database> {
  const database = await createTestDatabase()
  open.push(database)
  return database
}

afterEach(async () => {
  while (open.length) await open.pop()?.close()
})

function describeTick(r: TickResult): string {
  if (r.idle) return 'idle'
  const step = (r.job.payload.step as { kind?: string } | undefined)?.kind
  return `${r.job.kind}:${step ?? r.job.setExternalId ?? ''}:${r.outcome}`
}

async function drain(rt: Parameters<typeof runCatalogImportTick>[0], max = 60): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < max; i += 1) {
    const r = await runCatalogImportTick(rt)
    if (r.idle) break
    out.push(describeTick(r))
  }
  return out
}

describe('catalog import queue', () => {
  it('runs plan → set → graph steps to completion and matches the one-shot projection', async () => {
    const database = await fresh()
    const db = database.db
    const registry = createFixtureRegistry()
    const rt = { database, registry, source: FIXTURE_SOURCE }

    expect(await runCatalogImportTick(rt)).toEqual({ idle: true })
    const planId = await requestCatalogImport(db, 'pokemon', { full: true })
    expect(planId).toMatch(/^[0-9a-f-]{36}$/)
    // Asking again while the run is in progress returns the same plan.
    expect(await requestCatalogImport(db, 'pokemon')).toBe(planId)

    const ticks = await drain(rt)
    expect(ticks[0]).toBe('plan::done')
    expect(ticks[1]).toBe('set:base1:done')
    expect(ticks[2]).toBe('graph:scaffold:done')
    expect(ticks).toContain('graph:identities:done')
    expect(ticks).toContain('graph:printings:done')
    expect(ticks).toContain('graph:reprints:done')
    expect(ticks.at(-1)).toBe('graph:finish:done')
    expect(ticks.every((t) => t.endsWith(':done'))).toBe(true)

    const status = await getCatalogImportStatus(db, 'pokemon')
    expect(status.runId).toBe(planId)
    expect(status.finished).toBe(true)
    expect(status.failed).toBe(0)
    expect(status.setsTotal).toBe(1)
    expect(status.setsDone).toBe(1)
    expect(status.cardsExpected).toBe(102)
    expect(status.cardsImported).toBe(102)
    expect(status.graphPending).toBe(0)

    // Every job of the run carries the plan's id; the set job points at its ingestion run.
    const jobs = await db.select().from(catalogImportJobs)
    expect(jobs.every((j) => j.runId === planId)).toBe(true)
    expect(jobs.find((j) => j.kind === 'set')?.ingestionRunId).toBeTruthy()

    // The stepwise projection is exactly what the one-shot builder writes.
    const stepwiseNodes = (await db.select().from(graphNodes)).map((n) => n.id).sort()
    const stepwiseEdges = (await db.select().from(graphEdges)).map((e) => e.id).sort()
    expect(stepwiseNodes.length).toBeGreaterThan(250)
    await buildGraphProjection({ database, registry })
    expect((await db.select().from(graphNodes)).map((n) => n.id).sort()).toEqual(stepwiseNodes)
    expect((await db.select().from(graphEdges)).map((e) => e.id).sort()).toEqual(stepwiseEdges)

    // A new request when nothing changed at the source: the plan queues nothing.
    const second = await requestCatalogImport(db, 'pokemon')
    expect(second).not.toBe(planId)
    const plan = await runCatalogImportTick(rt)
    expect(plan.idle).toBe(false)
    if (!plan.idle) {
      expect(plan.job.kind).toBe('plan')
      expect(plan.detail.setsQueued).toBe(0)
      expect(plan.detail.graphQueued).toBe(false)
    }
    expect(await runCatalogImportTick(rt)).toEqual({ idle: true })
    expect((await getCatalogImportStatus(db, 'pokemon')).finished).toBe(true)
  })

  it('retries a failing job, gives up after the maximum attempts, and can be retried by hand', async () => {
    const database = await fresh()
    const db = database.db
    class BrokenSource extends FixtureSource {
      override async fetchSets(): Promise<never> {
        throw new Error('source is down')
      }
    }
    const registry = new AdapterRegistry().register(new PokemonAdapter(new BrokenSource('base1')))
    const rt = { database, registry, source: FIXTURE_SOURCE, maxAttempts: 2 }

    await requestCatalogImport(db, 'pokemon')
    expect(await drain(rt)).toEqual(['plan::retry', 'plan::failed'])
    const status = await getCatalogImportStatus(db, 'pokemon')
    expect(status.finished).toBe(true)
    expect(status.failed).toBe(1)
    expect(status.lastError).toContain('source is down')
    const failures = await listFailedCatalogJobs(db, 'pokemon')
    expect(failures).toHaveLength(1)
    expect(failures[0]?.attempts).toBe(2)

    // Nothing left to claim; a retry puts it back; a working adapter then completes it.
    expect(await claimNextCatalogJob(db)).toBeNull()
    expect(await retryFailedCatalogJobs(db, 'pokemon')).toBe(1)
    const healthy = { ...rt, registry: createFixtureRegistry() }
    const ticks = await drain(healthy)
    expect(ticks[0]).toBe('plan::done')
    expect(ticks.at(-1)).toBe('graph:finish:done')
  })

  it('claims a job whose worker went silent, after the stale delay, and respects the phase order', async () => {
    const database = await fresh()
    const db = database.db
    const registry = createFixtureRegistry()
    const planId = await requestCatalogImport(db, 'pokemon', { full: true })
    const plan = await runCatalogImportTick({ database, registry, source: FIXTURE_SOURCE })
    expect(plan.idle).toBe(false)

    // The set job is running on a worker that will never come back.
    const [setJob] = await claimNextCatalogJob(db).then((j) => [j])
    expect(setJob?.kind).toBe('set')
    // The graph scaffold must not start while a set job is running (fresh).
    expect(await claimNextCatalogJob(db, { staleAfterMs: 60_000 })).toBeNull()
    // Make the set job look abandoned, then it is claimed again with one more attempt.
    await db.execute(sql`update catalog_import_jobs set claimed_at = now() - interval '1 hour' where id = ${setJob?.id}`)
    const reclaimed = await claimNextCatalogJob(db, { staleAfterMs: 60_000 })
    expect(reclaimed?.id).toBe(setJob?.id)
    expect(reclaimed?.attempts).toBe(2)
    expect(reclaimed?.runId).toBe(planId)
  })

  it('serves the HTTP face: token check, request, tick, status', async () => {
    const database = await fresh()
    const registry = createFixtureRegistry()
    const base = { database, registry, source: FIXTURE_SOURCE }
    const call = (init: RequestInit & { token?: string | null; path?: string }, options = {}) =>
      handleCatalogImportRequest(
        new Request(`https://functions.example/catalog-import${init.path ?? ''}`, {
          method: init.method ?? 'POST',
          headers: init.token ? { 'x-catalog-import-token': init.token, 'content-type': 'application/json' } : {},
          body: init.body,
        }),
        { ...base, token: 'secret', ...options },
      )

    expect((await call({ method: 'GET' })).status).toBe(401)
    expect((await call({ token: 'wrong' })).status).toBe(401)
    expect((await call({ token: 'secret' }, { token: null })).status).toBe(503)

    const idle = await call({ token: 'secret' })
    expect(idle.status).toBe(200)
    expect(await idle.json()).toEqual({ idle: true })

    const requested = (await (await call({ token: 'secret', body: JSON.stringify({ request: true, full: true }) })).json()) as {
      requested: string
      status: { pending: number }
    }
    expect(requested.requested).toMatch(/^[0-9a-f-]{36}$/)
    expect(requested.status.pending).toBe(1)

    const refused = (await (await call({ token: 'secret' }, { acceptWork: () => false })).json()) as { idle: boolean; reason: string }
    expect(refused.idle).toBe(true)
    expect(refused.reason).toContain('not accepting')

    const first = (await (await call({ token: 'secret' })).json()) as { idle: boolean; job: { kind: string }; outcome: string }
    expect(first.idle).toBe(false)
    expect(first.job.kind).toBe('plan')
    expect(first.outcome).toBe('done')

    const status = (await (await call({ method: 'GET', token: 'secret', path: '?game=pokemon' })).json()) as {
      status: { setsTotal: number; finished: boolean }
      failures: unknown[]
    }
    expect(status.status.setsTotal).toBe(1)
    expect(status.status.finished).toBe(false)
    expect(status.failures).toEqual([])

    // A bearer token works too; an unknown method does not.
    const bearer = await handleCatalogImportRequest(
      new Request('https://functions.example/catalog-import', { method: 'GET', headers: { authorization: 'Bearer secret' } }),
      { ...base, token: 'secret' },
    )
    expect(bearer.status).toBe(200)
    const put = await handleCatalogImportRequest(
      new Request('https://functions.example/catalog-import', { method: 'PUT', headers: { 'x-catalog-import-token': 'secret' } }),
      { ...base, token: 'secret' },
    )
    expect(put.status).toBe(405)
  })
})

// The fixture adapter is also what the live worker registers, just with a different source.
void createPokemonFixtureAdapter
