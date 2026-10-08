import { IdentityResolutionError, type NormalizedCard } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { resolveIdentity } from '../resolver'

function card(overrides: Partial<NormalizedCard>): NormalizedCard {
  return {
    externalId: 'x-1',
    setExternalId: 'x',
    language: 'en',
    name: 'Charizard',
    identityEntityType: 'character',
    collectorNumber: '1',
    printedNumber: '1/10',
    category: 'pokemon',
    rarity: null,
    variant: 'standard',
    finish: 'normal',
    artistName: null,
    imageFront: null,
    imageBack: null,
    description: null,
    attributes: {},
    entities: [],
    rawHash: 'hash',
    ...overrides,
  }
}

describe('resolveIdentity', () => {
  it('maps case and whitespace variants of a name to the same identity', () => {
    const a = resolveIdentity(card({ name: 'Charizard' }))
    const b = resolveIdentity(card({ name: 'CHARIZARD', externalId: 'y-2', setExternalId: 'y' }))
    const c = resolveIdentity(card({ name: '  charizard ' }))
    expect(a.normalizedName).toBe('charizard')
    expect(b.normalizedName).toBe(a.normalizedName)
    expect(c.normalizedName).toBe(a.normalizedName)
    expect(b.entityType).toBe(a.entityType)
  })

  it('keeps the same identity for different printings of the same card', () => {
    const base = resolveIdentity(card({ setExternalId: 'base1', collectorNumber: '4' }))
    const evolutions = resolveIdentity(card({ setExternalId: 'xy12', collectorNumber: '11' }))
    expect(evolutions.normalizedName).toBe(base.normalizedName)
    expect(evolutions.canonicalName).toBe('Charizard')
  })

  it('distinguishes different cards with related names', () => {
    expect(resolveIdentity(card({ name: 'Charizard ex' })).normalizedName).toBe('charizard ex')
    expect(resolveIdentity(card({ name: 'Dark Charizard' })).normalizedName).toBe('dark charizard')
  })

  it('rejects empty names', () => {
    expect(() => resolveIdentity(card({ name: '   ' }))).toThrow(IdentityResolutionError)
  })
})
