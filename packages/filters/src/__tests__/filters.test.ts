import type { AdapterRegistry } from '@constellation/adapters'
import { sql, type Database } from '@constellation/database'
import { buildGraphProjection } from '@constellation/graph'
import { createSeededDatabase } from '@constellation/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { matchingPrintingNodeIds, parseSelection } from '../apply'
import { FilterService } from '../service'
import { UNIVERSAL_FILTERS } from '../universal'

let database: Database
let registry: AdapterRegistry
let service: FilterService
let gameId: string

beforeAll(async () => {
  const seeded = await createSeededDatabase()
  database = seeded.database
  registry = seeded.registry
  await buildGraphProjection({ database, registry })
  service = new FilterService(database.db, registry)
  const result = await database.db.execute(sql`select id from tcg_games where slug = 'pokemon'`)
  const rows = Array.isArray(result) ? result : (result as { rows: { id: string }[] }).rows
  gameId = (rows[0] as { id: string }).id
})

afterAll(async () => {
  await database.close()
})

describe('filter definitions', () => {
  it('merges universal and Pokémon filters with computed values', async () => {
    const defs = await service.definitions('pokemon')
    const ids = defs.map((d) => d.id)
    for (const universal of UNIVERSAL_FILTERS) expect(ids).toContain(universal.id)
    expect(ids).toContain('pokemon.type')
    // Card stats are data, not filters.
    expect(ids).not.toContain('pokemon.hp')
    expect(ids).not.toContain('pokemon.attack')
    expect(ids).not.toContain('pokemon.ability')
    expect(ids).not.toContain('pokemon.retreat')

    const type = defs.find((d) => d.id === 'pokemon.type')
    expect(type?.values?.some((v) => v.value === 'Fire' && (v.count ?? 0) > 0)).toBe(true)

    const stage = defs.find((d) => d.id === 'pokemon.stage')
    expect(stage?.values?.some((v) => v.value === 'Stage2' && (v.count ?? 0) > 0)).toBe(true)

    const depth = defs.find((d) => d.id === 'graphDepth')
    expect(depth?.min).toBe(1)
    expect(depth?.max).toBe(2)

    const set = defs.find((d) => d.id === 'set')
    expect(set?.values).toHaveLength(1)
    expect(set?.values?.[0]?.label).toBe('Base Set')
    expect(set?.values?.[0]?.count).toBe(102)

    const rarity = defs.find((d) => d.id === 'rarity')
    expect(rarity?.values?.map((v) => v.value)).toContain('Rare')

    const species = defs.find((d) => d.id === 'pokemon.species')
    expect(species?.values?.some((v) => v.label === 'Charizard' && v.value === 'dex:6')).toBe(true)

    const relationship = defs.find((d) => d.id === 'relationship')
    expect(relationship?.values?.some((v) => v.value === 'BELONGS_TO')).toBe(true)

    const tcg = defs.find((d) => d.id === 'tcg')
    expect(tcg?.values).toEqual([{ value: 'pokemon', label: 'Pokémon Trading Card Game' }])
  })

  it('caches definitions until invalidated', async () => {
    const a = await service.definitions('pokemon')
    const b = await service.definitions('pokemon')
    expect(b).toBe(a)
    service.invalidate('pokemon')
    const c = await service.definitions('pokemon')
    expect(c).not.toBe(a)
    expect(c).toEqual(a)
  })
})

describe('applying filters', () => {
  it('returns null when no printing-level filter is active', async () => {
    const defs = await service.definitions('pokemon')
    expect(await matchingPrintingNodeIds(database.db, gameId, defs, {})).toBeNull()
    expect(await matchingPrintingNodeIds(database.db, gameId, defs, { graphDepth: [1, 2] })).toBeNull()
  })

  it('narrows printings by attribute, column, entity and range filters', async () => {
    const defs = await service.definitions('pokemon')
    const fire = await matchingPrintingNodeIds(database.db, gameId, defs, { 'pokemon.type': ['Fire'] })
    expect(fire?.size).toBeGreaterThan(5)
    const fireRare = await matchingPrintingNodeIds(database.db, gameId, defs, {
      'pokemon.type': ['Fire'],
      rarity: ['Rare'],
    })
    expect(fireRare?.size).toBeGreaterThan(0)
    expect(fireRare?.size).toBeLessThan(fire?.size ?? 0)
    for (const id of fireRare ?? []) expect(fire?.has(id)).toBe(true)

    const charizard = await matchingPrintingNodeIds(database.db, gameId, defs, {
      'pokemon.species': 'dex:6',
    })
    expect(charizard?.size).toBe(1)

    const stage2 = await matchingPrintingNodeIds(database.db, gameId, defs, { 'pokemon.stage': ['Stage2'] })
    expect(stage2?.size).toBeGreaterThan(0)
    expect(stage2?.size).toBeLessThan(69)

    const trainers = await matchingPrintingNodeIds(database.db, gameId, defs, { cardType: ['trainer'] })
    expect(trainers?.size).toBeGreaterThan(10)
    const none = await matchingPrintingNodeIds(database.db, gameId, defs, { cardType: ['nope'] })
    expect(none?.size).toBe(0)
  })

  it('parses query-string selections by filter type', async () => {
    const defs = await service.definitions('pokemon')
    const selection = parseSelection(defs, {
      'pokemon.type': 'Fire,Water',
      graphDepth: '1..2',
      set: 'abc',
      unknown: 'x',
    })
    expect(selection).toEqual({
      'pokemon.type': ['Fire', 'Water'],
      graphDepth: [1, 2],
      set: 'abc',
    })
  })
})
