import { NormalizationError, type SourceCard } from '@constellation/domain'
import { beforeAll, describe, expect, it } from 'vitest'
import { finishFromVariants, imageUrl, normalizeCard } from '../normalizer'
import { FixtureSource } from '../sources'
import type { TCGdexCard } from '../tcgdex/types'

let cards: TCGdexCard[]

function toSource(card: TCGdexCard, language = 'en'): SourceCard {
  return {
    externalId: card.id,
    setExternalId: card.set.id,
    language,
    raw: card as unknown as Record<string, unknown>,
  }
}

beforeAll(async () => {
  cards = await new FixtureSource('base1').fetchCards()
})

describe('normalizeCard — TCGdex Charizard (Base Set)', () => {
  it('separates identity (name) from printing (set, number, finish)', () => {
    const charizard = cards.find((c) => c.id === 'base1-4')
    expect(charizard).toBeDefined()
    const normalized = normalizeCard(toSource(charizard as TCGdexCard))

    expect(normalized.name).toBe('Charizard')
    expect(normalized.identityEntityType).toBe('character')
    expect(normalized.setExternalId).toBe('base1')
    expect(normalized.collectorNumber).toBe('4')
    expect(normalized.printedNumber).toBe('4/102')
    expect(normalized.language).toBe('en')
    expect(normalized.rarity).toBe('Rare')
    expect(normalized.finish).toBe('holo')
    expect(normalized.variant).toBe('standard')
    expect(normalized.artistName).toBe('Mitsuhiro Arita')
    expect(normalized.imageFront).toBe('https://assets.tcgdex.net/en/base/base1/4/high.webp')
    expect(normalized.category).toBe('pokemon')
    expect(normalized.rawHash).toMatch(/^[0-9a-f]{64}$/)
    // The printing carries set-specific data; the identity does not.
    expect(normalized.collectorNumber).not.toBe(normalized.name)
  })

  it('captures Pokémon attributes for filters', () => {
    const normalized = normalizeCard(toSource(cards.find((c) => c.id === 'base1-4') as TCGdexCard))
    expect(normalized.attributes.hp).toBe(120)
    expect(normalized.attributes.types).toEqual(['Fire'])
    expect(normalized.attributes.stage).toBe('Stage2')
    expect(normalized.attributes.evolveFrom).toBe('Charmeleon')
    expect(normalized.attributes.dexIds).toEqual([6])
    expect(normalized.attributes.retreat).toBe(3)
    expect(normalized.attributes.finishes).toEqual(['holo', 'first-edition'])
    expect(normalized.attributes).not.toHaveProperty('pricing')
  })

  it('extracts semantic entities (species, types, mechanics)', () => {
    const normalized = normalizeCard(toSource(cards.find((c) => c.id === 'base1-4') as TCGdexCard))
    const byRelation = (relation: string) =>
      normalized.entities.filter((e) => e.relation === relation).map((e) => e.key)
    expect(byRelation('SAME_POKEMON')).toEqual(['dex:6'])
    expect(normalized.entities.find((e) => e.key === 'dex:6')?.name).toBe('Charizard')
    expect(byRelation('HAS_TYPE')).toEqual(['type:fire'])
    expect(byRelation('WEAK_TO')).toEqual(['type:water'])
    expect(byRelation('RESISTS')).toEqual(['type:fighting'])
    expect(byRelation('HAS_ABILITY')).toEqual(['ability:energy-burn'])
    // Attacks are card data, never entities (they stay in attributes for display only).
    expect(byRelation('HAS_ATTACK')).toEqual([])
    expect(normalized.entities.some((e) => e.key.startsWith('attack:'))).toBe(false)
    expect(Array.isArray(normalized.attributes.attacks)).toBe(true)
  })

  it('names the species from the Pokédex, not from the card name', () => {
    const charizard = cards.find((c) => c.id === 'base1-4') as TCGdexCard
    const renamed = { ...charizard, name: 'Charizard ex' }
    const normalized = normalizeCard(toSource(renamed))
    expect(normalized.name).toBe('Charizard ex')
    expect(normalized.entities.find((e) => e.kind === 'pokemon')?.name).toBe('Charizard')
  })

  it('maps trainer and energy categories', () => {
    const trainer = cards.find((c) => c.category === 'Trainer') as TCGdexCard
    const energy = cards.find((c) => c.category === 'Energy') as TCGdexCard
    expect(normalizeCard(toSource(trainer)).identityEntityType).toBe('trainer')
    expect(normalizeCard(toSource(energy)).identityEntityType).toBe('energy')
    expect(normalizeCard(toSource(energy)).entities.some((e) => e.kind === 'pokemon')).toBe(false)
  })

  it('rejects payloads that still contain prices', () => {
    const charizard = cards.find((c) => c.id === 'base1-4') as TCGdexCard
    const withPrices = { ...charizard, pricing: { cardmarket: { avg: 1 } } }
    expect(() => normalizeCard(toSource(withPrices))).toThrow(NormalizationError)
  })

  it('rejects records missing required fields', () => {
    const charizard = cards.find((c) => c.id === 'base1-4') as TCGdexCard
    const { name: _name, ...noName } = charizard
    expect(() => normalizeCard(toSource(noName as TCGdexCard))).toThrow(NormalizationError)
    const mismatch = toSource(charizard)
    mismatch.setExternalId = 'base2'
    expect(() => normalizeCard(mismatch)).toThrow(NormalizationError)
  })

  it('normalizes the whole Base Set fixture without errors', () => {
    const normalized = cards.map((c) => normalizeCard(toSource(c)))
    expect(normalized).toHaveLength(102)
    expect(new Set(normalized.map((n) => n.externalId)).size).toBe(102)
    expect(normalized.every((n) => n.imageFront?.endsWith('/high.webp'))).toBe(true)
    expect(normalized.every((n) => n.collectorNumber.length > 0)).toBe(true)
    expect(normalized.every((n) => n.artistName)).toBe(true)
  })
})

describe('helpers', () => {
  it('builds image urls from the TCGdex base', () => {
    expect(imageUrl('https://assets.tcgdex.net/en/base/base1/4')).toBe(
      'https://assets.tcgdex.net/en/base/base1/4/high.webp',
    )
    expect(imageUrl('https://assets.tcgdex.net/en/base/base1/4/', 'low')).toBe(
      'https://assets.tcgdex.net/en/base/base1/4/low.webp',
    )
    expect(imageUrl(undefined)).toBeNull()
  })

  it('derives the primary finish from variants', () => {
    expect(finishFromVariants({ normal: true, holo: true })).toBe('normal')
    expect(finishFromVariants({ normal: false, holo: true })).toBe('holo')
    expect(finishFromVariants({ reverse: true })).toBe('reverse')
    expect(finishFromVariants({})).toBe('other')
    expect(finishFromVariants(undefined)).toBe('normal')
  })
})
