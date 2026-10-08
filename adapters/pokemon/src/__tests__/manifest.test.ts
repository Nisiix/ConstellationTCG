import { describe, expect, it } from 'vitest'
import { POKEMON_DEFINITION, POKEMON_PLACEHOLDER_LOGO, POKEMON_THEME } from '../manifest'

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

  it('exposes Pokémon relationship and node types to the core', () => {
    expect(POKEMON_DEFINITION.relationshipTypes).toContain('EVOLVES_FROM')
    expect(POKEMON_DEFINITION.nodeTypes).toEqual(['pokemon', 'attribute', 'mechanic'])
    expect(POKEMON_DEFINITION.filters.every((f) => f.scope === 'game' && f.id.startsWith('pokemon.'))).toBe(true)
  })
})
