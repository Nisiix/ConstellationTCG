import { describe, expect, it } from 'vitest'
import {
  collectorNumberFromPrinted,
  compareCollectorNumbers,
  normalizeName,
  slugify,
  stableStringify,
} from '../normalize'

describe('normalizeName', () => {
  it('folds case, whitespace and diacritics into one identity key', () => {
    expect(normalizeName('Charizard')).toBe('charizard')
    expect(normalizeName('CHARIZARD')).toBe('charizard')
    expect(normalizeName('  charizard ')).toBe('charizard')
    expect(normalizeName('Pokémon   Center')).toBe('pokemon center')
  })

  it('keeps distinct card names distinct', () => {
    expect(normalizeName('Charizard ex')).not.toBe(normalizeName('Charizard'))
    expect(normalizeName('Dark Charizard')).not.toBe(normalizeName('Charizard'))
  })
})

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Base Set')).toBe('base-set')
    expect(slugify('Scarlet & Violet—151')).toBe('scarlet-violet-151')
    expect(slugify('  Pokémon GO ')).toBe('pokemon-go')
  })
})

describe('stableStringify', () => {
  it('is independent of key order and drops undefined', () => {
    expect(stableStringify({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe(
      stableStringify({ a: { d: [1, { y: 2, z: 1 }] }, b: 1 }),
    )
  })
})

describe('collector numbers', () => {
  it('extracts the number from the printed form', () => {
    expect(collectorNumberFromPrinted('4/102')).toBe('4')
    expect(collectorNumberFromPrinted('SV045/SV122')).toBe('SV045')
    expect(collectorNumberFromPrinted('12')).toBe('12')
  })

  it('sorts numerically with prefixed numbers after plain ones', () => {
    const sorted = ['10', '2', 'TG12', '1', 'TG3'].sort(compareCollectorNumbers)
    expect(sorted).toEqual(['1', '2', '10', 'TG3', 'TG12'])
  })
})
