import { describe, expect, it } from 'vitest'
import { POKEMON_DEFINITION, POKEMON_PLACEHOLDER_LOGO, POKEMON_THEME, TCGDEX_LICENSE_URL } from '../manifest'

describe('Pokémon manifest', () => {
  it('uses red and white for contours only, never as backgrounds', () => {
    expect(POKEMON_DEFINITION.theme).toBe(POKEMON_THEME)
    expect(POKEMON_THEME.primary.toLowerCase()).toBe('#e3242b')
    // Sets and series are outlined in red; cards, Pokémon and artists in the contrast color.
    expect(POKEMON_THEME.nodes.set).toBe('primary')
    expect(POKEMON_THEME.nodes.card_identity).toBe('contrast')
    expect(POKEMON_THEME.edges.BELONGS_TO).toBe('primary')

    const { dark, light } = POKEMON_THEME.modes
    // Near-white contours on a dirty black; near-black contours on a dirty white.
    expect(dark.contrast.toLowerCase()).toBe('#f7f3ee')
    expect(dark.background.toLowerCase()).toBe('#141214')
    expect(light.contrast.toLowerCase()).toBe('#1b1618')
    expect(light.background.toLowerCase()).toBe('#f3efe8')
    for (const mode of [dark, light]) {
      expect(mode.background).not.toBe(POKEMON_THEME.primary)
      expect(mode.surface).not.toBe(POKEMON_THEME.primary)
      expect(mode.nodeFill).not.toBe(POKEMON_THEME.primary)
      // The accent (a lighter red) is a contour color too, never a fill.
      expect(mode.background).not.toBe(POKEMON_THEME.accent)
    }
  })

  it('falls back to the classic Pokémon logo for sets and series without an image', () => {
    expect(POKEMON_PLACEHOLDER_LOGO).toMatch(/\/base1\/logo\.webp$/)
    expect(POKEMON_DEFINITION.placeholderImages?.set).toBe(POKEMON_PLACEHOLDER_LOGO)
    expect(POKEMON_DEFINITION.placeholderImages?.series).toBe(POKEMON_PLACEHOLDER_LOGO)
    expect(POKEMON_DEFINITION.placeholderImages?.game).toBe(POKEMON_PLACEHOLDER_LOGO)
    expect(POKEMON_DEFINITION.placeholderImages?.card_printing).toBeUndefined()
  })

  it('credits TCGdex under the MIT license, keeps images out of it and names every rights holder', () => {
    const { source, rightsHolders, disclaimer } = POKEMON_DEFINITION.attribution
    // MIT's only condition: the copyright notice travels with the data.
    expect(source.license).toEqual({ name: 'MIT License', notice: 'Copyright (c) 2021 TCGdex', url: TCGDEX_LICENSE_URL })
    expect(source.termsUrl).toBe(TCGDEX_LICENSE_URL)
    expect(source.terms).toMatch(/MIT License/)
    // The scans are not licensed by TCGdex: say so, and that they are linked, never stored.
    expect(source.terms).toMatch(/images are not covered/i)
    expect(source.terms).toMatch(/never stored/)
    // Official line, current year, trademarks and image ownership.
    expect(rightsHolders).toContain(`©1995–${new Date().getFullYear()} Nintendo/Creatures Inc./GAME FREAK inc.`)
    expect(rightsHolders).toMatch(/trademarks of Nintendo/)
    expect(rightsHolders).toMatch(/property of The Pokémon Company International/)
    expect(disclaimer).toMatch(/not produced, endorsed, supported or affiliated with/)
    for (const party of ['Nintendo', 'Creatures Inc.', 'GAME FREAK inc.', 'The Pokémon Company', 'TCGdex']) {
      expect(disclaimer).toContain(party)
    }
    expect(disclaimer).toMatch(/No prices are shown and nothing is sold/)
    // No "with attribution": attribution is our choice, not an MIT duty; no "resold": nothing is sold.
    expect(source.terms).not.toMatch(/resold|with attribution/)
  })

  it('exposes Pokémon relationship and node types to the core', () => {
    expect(POKEMON_DEFINITION.relationshipTypes).toContain('EVOLVES_FROM')
    // Only the Pokémon are points; energy types stay card data and filters.
    expect(POKEMON_DEFINITION.nodeTypes).toEqual(['pokemon'])
    expect(POKEMON_DEFINITION.subjectRelation).toBe('SAME_POKEMON')
    expect(POKEMON_DEFINITION.relationshipTypes).not.toContain('HAS_TYPE')
    expect(POKEMON_DEFINITION.filters.every((f) => f.scope === 'game' && f.id.startsWith('pokemon.'))).toBe(true)
  })
})
