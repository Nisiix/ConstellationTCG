import { describe, expect, it } from 'vitest'
import { baseSpeciesName, prettifySpeciesSlug, speciesName } from '../pokedex'

describe('pokedex table', () => {
  it('resolves national dex numbers to display names', () => {
    expect(speciesName(6)).toBe('Charizard')
    expect(speciesName(25)).toBe('Pikachu')
    expect(speciesName(122)).toBe('Mr. Mime')
    expect(speciesName(29)).toBe('Nidoran♀')
    expect(speciesName(250)).toBe('Ho-Oh')
    expect(speciesName(99999)).toBeNull()
  })
})

describe('prettifySpeciesSlug', () => {
  it('handles hyphenated and special names', () => {
    expect(prettifySpeciesSlug('great-tusk')).toBe('Great Tusk')
    expect(prettifySpeciesSlug('tapu-koko')).toBe('Tapu Koko')
    expect(prettifySpeciesSlug('porygon-z')).toBe('Porygon-Z')
    expect(prettifySpeciesSlug('farfetchd')).toBe("Farfetch'd")
    expect(prettifySpeciesSlug('type-null')).toBe('Type: Null')
    expect(prettifySpeciesSlug('kommo-o')).toBe('Kommo-o')
  })
})

describe('baseSpeciesName', () => {
  it('strips owner prefixes, form prefixes and mechanic suffixes', () => {
    expect(baseSpeciesName('Charizard ex')).toBe('Charizard')
    expect(baseSpeciesName('Charizard VMAX')).toBe('Charizard')
    expect(baseSpeciesName('Dark Charizard')).toBe('Charizard')
    expect(baseSpeciesName("Brock's Onix")).toBe('Onix')
    expect(baseSpeciesName('M Charizard-EX')).toBe('Charizard')
    expect(baseSpeciesName('Mewtwo')).toBe('Mewtwo')
  })
})
