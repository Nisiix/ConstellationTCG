import type { Database } from '@constellation/database'
import { buildGraphProjection } from '@constellation/graph'
import { createSeededDatabase } from '@constellation/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { search } from '../search'

let database: Database

beforeAll(async () => {
  const seeded = await createSeededDatabase()
  database = seeded.database
  await buildGraphProjection({ database, registry: seeded.registry })
})

afterAll(async () => {
  await database.close()
})

describe('search', () => {
  it('matches prefixes across the Charmander line', async () => {
    const hits = await search(database.db, { q: 'char', game: 'pokemon', types: ['card_identity'] })
    expect(hits.map((h) => h.title)).toEqual(['Charizard', 'Charmander', 'Charmeleon'])
    expect(hits.every((h) => h.match === 'prefix')).toBe(true)
  })

  it('ranks exact matches and semantic hubs first', async () => {
    const hits = await search(database.db, { q: 'Charizard', game: 'pokemon' })
    expect(hits[0]?.type).toBe('card_identity')
    expect(hits[0]?.title).toBe('Charizard')
    expect(hits[0]?.match).toBe('exact')
    const types = hits.map((h) => h.type)
    expect(types).toContain('card_printing')
    expect(types).toContain('pokemon')
    const printing = hits.find((h) => h.type === 'card_printing')
    expect(printing?.subtitle).toBe('Base Set · 4/102')
    expect(printing?.image).toContain('/high.webp')
  })

  it('finds sets, series and artists', async () => {
    expect((await search(database.db, { q: 'base set' }))[0]?.type).toBe('set')
    expect((await search(database.db, { q: 'base', types: ['series'] }))[0]?.title).toBe('Base')
    const artist = await search(database.db, { q: 'arita' })
    expect(artist[0]?.type).toBe('artist')
    expect(artist[0]?.title).toBe('Mitsuhiro Arita')
    expect(artist[0]?.match).toBe('word')
  })

  it('tolerates typos through trigram similarity', async () => {
    const hits = await search(database.db, { q: 'charizrd' })
    expect(hits[0]?.title).toBe('Charizard')
    expect(hits[0]?.match).toBe('fuzzy')
  })

  it('is case and accent insensitive', async () => {
    const upper = await search(database.db, { q: 'PIKACHU' })
    const accent = await search(database.db, { q: 'pikachú' })
    expect(upper[0]?.title).toBe('Pikachu')
    expect(accent[0]?.title).toBe('Pikachu')
  })

  it('respects limits, type filters and empty queries', async () => {
    expect(await search(database.db, { q: '   ' })).toEqual([])
    const limited = await search(database.db, { q: 'a', limit: 3 })
    expect(limited.length).toBeLessThanOrEqual(3)
    const sets = await search(database.db, { q: 'b', types: ['set'] })
    expect(sets.every((h) => h.type === 'set')).toBe(true)
    expect(await search(database.db, { q: 'charizard', game: 'not-a-game' })).toEqual([])
  })

  it('caps printings so hubs stay visible', async () => {
    const hits = await search(database.db, { q: 'energy', limit: 20 })
    expect(hits.filter((h) => h.type === 'card_printing').length).toBeLessThanOrEqual(6)
    expect(hits.some((h) => h.type === 'card_identity')).toBe(true)
  })
})
