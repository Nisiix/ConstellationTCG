import { createPokemonFixtureAdapter, PokemonAdapter, FixtureSource } from '@constellation/adapter-pokemon'
import type { TCGdexCard } from '@constellation/adapter-pokemon'
import {
  cardIdentities,
  cardPrintings,
  createPgliteDatabase,
  entities,
  ingestionErrors,
  ingestionRuns,
  printingEntities,
  runMigrations,
  sourceSnapshots,
  sql,
  tcgSeries,
  tcgSets,
  type Database,
} from '@constellation/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runIngestion, type IngestionReport } from '../pipeline'

let database: Database
let report: IngestionReport

const source = { name: 'tcgdex', type: 'api' as const, baseUrl: 'https://api.tcgdex.net/v2' }

beforeAll(async () => {
  database = await createPgliteDatabase(':memory:')
  await runMigrations(database)
  report = await runIngestion({
    database,
    adapter: createPokemonFixtureAdapter('base1'),
    mode: 'fixture',
    source,
  })
})

afterAll(async () => {
  await database.close()
})

async function count(table: string): Promise<number> {
  const result = await database.db.execute<{ n: number | string }>(
    sql.raw(`select count(*)::int as n from ${table}`),
  )
  const rows = Array.isArray(result) ? result : (result as { rows: { n: number }[] }).rows
  return Number(rows[0]?.n ?? 0)
}

describe('fixture ingestion (Base Set)', () => {
  it('records a successful run with the expected counts', async () => {
    expect(report.status).toBe('succeeded')
    expect(report.errors).toBe(0)
    expect(report.series.created).toBe(1)
    expect(report.sets.created).toBe(1)
    expect(report.cards.created).toBe(102)
    expect(report.cards.failed).toBe(0)

    const runs = await database.db.select().from(ingestionRuns)
    expect(runs).toHaveLength(1)
    expect(runs[0]?.status).toBe('succeeded')
    expect(runs[0]?.recordsCreated).toBe(104)
    expect(runs[0]?.finishedAt).not.toBeNull()
  })

  it('creates series, sets and printings with provenance', async () => {
    expect(await count('tcg_series')).toBe(1)
    expect(await count('tcg_sets')).toBe(1)
    expect(await count('card_printings')).toBe(102)
    expect(await count('source_snapshots')).toBe(104)
    expect(await count('external_ids')).toBe(104)

    const [set] = await database.db.select().from(tcgSets)
    expect(set?.name).toBe('Base Set')
    expect(set?.slug).toBe('base-set')
    expect(set?.releaseDate).toBe('1999-01-09')
    expect(set?.cardCountOfficial).toBe(102)
    expect(set?.logoUrl).toBe('https://assets.tcgdex.net/en/base/base1/logo.webp')
    const [series] = await database.db.select().from(tcgSeries)
    expect(series?.name).toBe('Base')
  })

  it('does not create duplicate identities or printings', async () => {
    const identities = await database.db.select().from(cardIdentities)
    const keys = identities.map((i) => `${i.entityType}|${i.normalizedName}`)
    expect(new Set(keys).size).toBe(keys.length)
    // Base Set has 102 cards and a handful of them share a name (e.g. basic energies are distinct
    // identities, but "Potion"/"Switch" appear once). Every identity must have >= 1 printing.
    const printings = await database.db.select().from(cardPrintings)
    const identityIds = new Set(printings.map((p) => p.identityId))
    expect(identityIds.size).toBe(identities.length)
    expect(new Set(printings.map((p) => p.externalId)).size).toBe(102)
  })

  it('links printings to semantic entities and artists', async () => {
    const charizard = (await database.db.select().from(cardPrintings)).find(
      (p) => p.externalId === 'base1-4',
    )
    expect(charizard).toBeDefined()
    expect(charizard?.collectorNumber).toBe('4')
    expect(charizard?.printedNumber).toBe('4/102')
    expect(charizard?.finish).toBe('holo')
    expect(charizard?.imageFront).toContain('/high.webp')
    expect(charizard?.artistId).not.toBeNull()
    expect(charizard?.attributes).not.toHaveProperty('pricing')

    const links = await database.db
      .select()
      .from(printingEntities)
      .where(sql`${printingEntities.printingId} = ${charizard?.id}`)
    const relations = links.map((l) => l.relation).sort()
    expect(relations).toEqual(
      ['HAS_TYPE', 'RESISTS', 'SAME_POKEMON', 'WEAK_TO'].sort(),
    )
    const species = (await database.db.select().from(entities)).find((e) => e.key === 'dex:6')
    expect(species?.name).toBe('Charizard')
    expect(species?.kind).toBe('pokemon')
  })

  it('is incremental: a second run leaves everything unchanged', async () => {
    const second = await runIngestion({
      database,
      adapter: createPokemonFixtureAdapter('base1'),
      mode: 'incremental',
      source,
    })
    expect(second.status).toBe('succeeded')
    expect(second.series.unchanged).toBe(1)
    expect(second.sets.unchanged).toBe(1)
    expect(second.cards.unchanged).toBe(102)
    expect(second.cards.created + second.cards.updated).toBe(0)
    expect(await count('card_printings')).toBe(102)
    expect(await count('ingestion_runs')).toBe(2)
  })

  it('records invalid records in ingestion_errors without blocking the run', async () => {
    class BrokenSource extends FixtureSource {
      override async fetchCards() {
        const cards = await super.fetchCards()
        const broken = cards.map((c) => (c.id === 'base1-4' ? { ...c, name: '' } : c))
        // A record that still carries prices must be rejected as well.
        const priced = { ...(cards[0] as TCGdexCard), id: 'base1-999', localId: '999', pricing: { x: 1 } }
        return [...broken, priced as TCGdexCard]
      }
    }
    const fresh = await createPgliteDatabase(':memory:')
    await runMigrations(fresh)
    try {
      const result = await runIngestion({
        database: fresh,
        adapter: new PokemonAdapter(new BrokenSource('base1')),
        mode: 'fixture',
        source,
      })
      expect(result.status).toBe('partial')
      expect(result.cards.seen).toBe(103)
      expect(result.cards.failed).toBe(2)
      expect(result.cards.created).toBe(101)
      const errors = await fresh.db.select().from(ingestionErrors)
      expect(errors).toHaveLength(2)
      expect(errors.map((e) => e.recordId).sort()).toEqual(['card:en/base1-4', 'card:en/base1-999'])
      expect(errors.every((e) => e.errorType === 'normalization')).toBe(true)
      const [run] = await fresh.db.select().from(ingestionRuns)
      expect(run?.status).toBe('partial')
      expect(run?.recordsFailed).toBe(2)
      const snapshots = await fresh.db.select().from(sourceSnapshots)
      expect(snapshots.some((s) => s.recordId === 'en/base1-999')).toBe(false)
    } finally {
      await fresh.close()
    }
  })
})
