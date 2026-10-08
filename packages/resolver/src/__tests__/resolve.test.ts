import { assetResolutionCandidates, digitalAssets, type Database } from '@constellation/database'
import { createSeededDatabase } from '@constellation/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findCandidates } from '../candidates'
import { recordResolution, resolveAsset } from '../resolve'

let database: Database

beforeAll(async () => {
  database = (await createSeededDatabase()).database
})

afterAll(async () => {
  await database.close()
})

describe('resolver over the catalog', () => {
  it('finds candidates by name and resolves with set and number', async () => {
    const candidates = await findCandidates(database.db, { game: 'pokemon', name: 'Charizard' })
    expect(candidates.map((c) => c.identityName)).toContain('Charizard')
    const result = await resolveAsset(database.db, { game: 'pokemon', name: 'Charizard', set: 'Base Set', cardNumber: '4', language: 'en' })
    expect(result.status).toBe('resolved')
    expect(result.candidates[0]?.reasons).toContain('number')
  })

  it('stays ambiguous on a bare name, and unresolved on an unknown card', async () => {
    const bare = await resolveAsset(database.db, { game: 'pokemon', name: 'Charizard' })
    expect(bare.status).toBe('ambiguous')
    const unknown = await resolveAsset(database.db, { game: 'pokemon', name: 'Zoroark' })
    expect(unknown.status).toBe('unresolved')
    expect(unknown.candidates).toHaveLength(0)
  })

  it('resolves by source external id', async () => {
    const result = await resolveAsset(database.db, { externalIds: { tcgdex: 'base1-58' } })
    expect(result.status).toBe('resolved')
    expect(result.confidence).toBe(1)
  })

  it('records the candidates of a stored asset and replaces them on re-run', async () => {
    const [asset] = await database.db
      .insert(digitalAssets)
      .values({ platform: 'test', chain: null, contractAddress: null, tokenId: '1', name: 'Charizard Base Set 4/102' })
      .returning({ id: digitalAssets.id })
    if (!asset) throw new Error('asset not created')
    const result = await resolveAsset(database.db, { game: 'pokemon', name: 'Charizard', set: 'Base Set', cardNumber: '4' })
    await recordResolution(database.db, asset.id, result)
    const stored = await database.db.select().from(assetResolutionCandidates)
    expect(stored.filter((r) => r.assetId === asset.id).some((r) => r.status === 'resolved')).toBe(true)
    await recordResolution(database.db, asset.id, { status: 'unresolved', confidence: 0, candidates: [] })
    const after = await database.db.select().from(assetResolutionCandidates)
    expect(after.filter((r) => r.assetId === asset.id)).toHaveLength(0)
  })
})
