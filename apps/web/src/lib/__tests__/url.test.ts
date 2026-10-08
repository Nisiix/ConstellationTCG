import { describe, expect, it } from 'vitest'
import { buildExploreUrl, filtersKey, parseExploreParams } from '../url'

describe('explore url', () => {
  it('round-trips node, depth, view and filters', () => {
    const url = buildExploreUrl({
      node: 'card_printing:abc',
      depth: 2,
      view: 'list',
      filters: { 'pokemon.type': 'Fire,Water', rarity: 'Rare' },
    })
    expect(url).toBe('/explore?node=card_printing%3Aabc&depth=2&view=list&f.pokemon.type=Fire%2CWater&f.rarity=Rare')
    const parsed = parseExploreParams(new URLSearchParams(url.split('?')[1]))
    expect(parsed).toEqual({
      node: 'card_printing:abc',
      depth: 2,
      view: 'list',
      game: 'pokemon',
      filters: { 'pokemon.type': 'Fire,Water', rarity: 'Rare' },
    })
  })

  it('omits defaults and ignores malformed values', () => {
    expect(buildExploreUrl({ node: null, depth: 1, view: null, filters: {} })).toBe('/explore')
    const parsed = parseExploreParams(new URLSearchParams('node=not-a-node&depth=99&view=weird'))
    expect(parsed.node).toBeNull()
    expect(parsed.depth).toBe(3)
    expect(parsed.view).toBeNull()
    expect(parseExploreParams(new URLSearchParams('depth=-2')).depth).toBe(1)
  })

  it('defaults depth to 1 when the parameter is missing (regression: Number(null) is 0)', () => {
    expect(parseExploreParams(new URLSearchParams('node=card_printing%3Aabc')).depth).toBe(1)
    expect(parseExploreParams(new URLSearchParams('depth=')).depth).toBe(1)
    expect(parseExploreParams(new URLSearchParams('depth=0')).depth).toBe(0)
  })

  it('builds a stable key for filter records', () => {
    expect(filtersKey({ b: '2', a: '1' })).toBe('a=1&b=2')
    expect(filtersKey({})).toBe('')
  })
})
