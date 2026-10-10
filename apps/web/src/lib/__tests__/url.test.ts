import { describe, expect, it } from 'vitest'
import { buildExploreUrl, filtersKey, parseExploreParams, threadPath } from '../url'

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
      path: null,
      pathMax: null,
      panel: null,
      year: null,
      lens: null,
    })
  })

  it('round-trips the time cursor and the dedicated views, and drops what does not fit', () => {
    const url = buildExploreUrl({ node: 'pokemon:charizard', lens: 'lineage', year: 1999 })
    expect(url).toBe('/explore?node=pokemon%3Acharizard&lens=lineage&year=1999')
    const parsed = parseExploreParams(new URLSearchParams(url.split('?')[1]))
    expect(parsed.lens).toBe('lineage')
    expect(parsed.year).toBe(1999)
    expect(buildExploreUrl({ lens: 'landmarks' })).toBe('/explore?lens=landmarks')
    // A lineage needs a point; a path is a view of its own; a year must be a plausible year.
    expect(parseExploreParams(new URLSearchParams('lens=lineage')).lens).toBeNull()
    expect(buildExploreUrl({ lens: 'lineage' })).toBe('/explore')
    expect(parseExploreParams(new URLSearchParams('lens=landmarks&path=set:a,set:b')).lens).toBeNull()
    expect(parseExploreParams(new URLSearchParams('lens=sideways')).lens).toBeNull()
    expect(parseExploreParams(new URLSearchParams('year=12')).year).toBeNull()
    expect(parseExploreParams(new URLSearchParams('year=1999.5')).year).toBeNull()
  })

  it('round-trips the page opened over the explorer, and drops a malformed one', () => {
    const list = { kind: 'list' as const, relationshipType: 'ILLUSTRATED_BY', direction: 'in' as const, of: 'artist:arita' }
    const url = buildExploreUrl({ node: 'card_printing:abc', panel: list })
    expect(url).toBe('/explore?node=card_printing%3Aabc&panel=list&rel=ILLUSTRATED_BY&dir=in&of=artist%3Aarita')
    expect(parseExploreParams(new URLSearchParams(url.split('?')[1])).panel).toEqual(list)
    expect(parseExploreParams(new URLSearchParams('node=set:a&panel=details')).panel).toEqual({ kind: 'details' })
    expect(parseExploreParams(new URLSearchParams('panel=list&rel=BELONGS_TO&dir=in')).panel).toEqual({
      kind: 'list',
      relationshipType: 'BELONGS_TO',
      direction: 'in',
      of: null,
    })
    expect(parseExploreParams(new URLSearchParams('panel=list&rel=belongs;drop&dir=in')).panel).toBeNull()
    expect(parseExploreParams(new URLSearchParams('panel=list&rel=BELONGS_TO&dir=sideways')).panel).toBeNull()
    expect(parseExploreParams(new URLSearchParams('panel=list&rel=BELONGS_TO&dir=in&of=nonsense')).panel).toMatchObject({ of: null })
    expect(parseExploreParams(new URLSearchParams('panel=elsewhere')).panel).toBeNull()
  })

  it('caps the depth at the two levels (Direct, Extended)', () => {
    expect(parseExploreParams(new URLSearchParams('depth=3')).depth).toBe(2)
  })

  it('round-trips a path and how far it searches, starting on its first end', () => {
    const url = buildExploreUrl({ node: null, depth: 1, view: null, filters: {}, path: ['card_printing:a', 'artist:b'], pathMax: 8 })
    expect(url).toBe('/explore?path=card_printing%3Aa%2Cartist%3Ab&max=8')
    const parsed = parseExploreParams(new URLSearchParams(url.split('?')[1]))
    expect(parsed.path).toEqual(['card_printing:a', 'artist:b'])
    expect(parsed.pathMax).toBe(8)
    expect(parsed.node).toBe('card_printing:a')
    expect(parseExploreParams(new URLSearchParams('path=card_printing:a,artist:b&node=artist:b')).node).toBe('artist:b')
  })

  it('ignores a malformed path and caps how far it searches', () => {
    expect(parseExploreParams(new URLSearchParams('path=card_printing:a')).path).toBeNull()
    expect(parseExploreParams(new URLSearchParams('path=nonsense,artist:b')).path).toBeNull()
    expect(parseExploreParams(new URLSearchParams('path=set:a,set:b&max=99')).pathMax).toBe(8)
    expect(parseExploreParams(new URLSearchParams('max=8')).pathMax).toBeNull()
  })

  it('gives a path its shareable address', () => {
    expect(threadPath('card_printing:a', 'artist:b')).toBe('/thread/card_printing%3Aa/artist%3Ab')
    expect(threadPath('set:a', 'set:b', 'list')).toBe('/thread/set%3Aa/set%3Ab?view=list')
  })

  it('omits defaults and ignores malformed values', () => {
    expect(buildExploreUrl({ node: null, depth: 1, view: null, filters: {} })).toBe('/explore')
    const parsed = parseExploreParams(new URLSearchParams('node=not-a-node&depth=99&view=weird'))
    expect(parsed.node).toBeNull()
    expect(parsed.depth).toBe(2)
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
