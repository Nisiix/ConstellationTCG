import { describe, expect, it } from 'vitest'
import { POKEMON_DEFINITION, POKEMON_THEME } from '../manifest'

describe('Pokémon manifest', () => {
  it('declares the red / white / black palette', () => {
    expect(POKEMON_DEFINITION.theme).toBe(POKEMON_THEME)
    expect(POKEMON_THEME.primary.toLowerCase()).toBe('#ff2f45')
    expect(POKEMON_THEME.secondary.toLowerCase()).toBe('#ffffff')
    expect(POKEMON_THEME.outline.toLowerCase()).toBe('#000000')
    expect(POKEMON_THEME.nodes.card_identity).toBe('#ffffff')
    expect(POKEMON_THEME.edges.BELONGS_TO).toBe(POKEMON_THEME.primary)
  })

  it('exposes Pokémon relationship and node types to the core', () => {
    expect(POKEMON_DEFINITION.relationshipTypes).toContain('EVOLVES_FROM')
    expect(POKEMON_DEFINITION.nodeTypes).toEqual(['pokemon', 'attribute', 'mechanic'])
    expect(POKEMON_DEFINITION.filters.every((f) => f.scope === 'game' && f.id.startsWith('pokemon.'))).toBe(true)
  })
})
