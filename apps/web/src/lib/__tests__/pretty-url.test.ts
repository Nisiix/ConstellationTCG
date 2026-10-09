import { describe, expect, it } from 'vitest'
import { buildCardSlug, parseCardSlug, prettyNodePath, prettySharePath } from '../pretty-url'

const SETS = ['base-set', 'base-set-2', 'jungle', 'scarlet-violet']

describe('card slugs', () => {
  it('builds and parses a readable slug', () => {
    const slug = buildCardSlug('Charizard', 'base-set', '4')
    expect(slug).toBe('charizard-base-set-4')
    expect(parseCardSlug(slug, SETS)).toEqual({
      name: 'charizard',
      setSlug: 'base-set',
      number: '4',
    })
  })

  it('picks the longest set slug and keeps multi-word names', () => {
    expect(parseCardSlug('mr-mime-base-set-2-7', SETS)).toEqual({
      name: 'mr-mime',
      setSlug: 'base-set-2',
      number: '7',
    })
    expect(parseCardSlug("Farfetch'd-Jungle-27".toLowerCase(), SETS)).toEqual({
      name: "farfetch'd",
      setSlug: 'jungle',
      number: '27',
    })
    expect(parseCardSlug('Charizard-ex-scarlet-violet-125', SETS)).toEqual({
      name: 'charizard-ex',
      setSlug: 'scarlet-violet',
      number: '125',
    })
  })

  it('refuses slugs that name no known set or have no name', () => {
    expect(parseCardSlug('charizard-unknown-4', SETS)).toBeNull()
    expect(parseCardSlug('base-set-4', SETS)).toBeNull()
    expect(parseCardSlug('base1-4', SETS)).toBeNull()
    expect(parseCardSlug('x', SETS)).toBeNull()
  })
})

describe('pretty paths', () => {
  const printing = {
    nodeType: 'card_printing' as const,
    label: 'Charizard',
    metadata: { setSlug: 'base-set', collectorNumber: '4' },
  }
  const set = { nodeType: 'set' as const, label: 'Base Set', metadata: { slug: 'base-set' } }
  const params = {
    node: null,
    depth: 2,
    view: 'list' as const,
    game: 'pokemon',
    filters: { rarity: 'Rare' },
  }

  it('addresses printings and sets, nothing else', () => {
    expect(prettyNodePath(printing, 'pokemon')).toBe('/card/pokemon/charizard-base-set-4')
    expect(prettyNodePath(set, 'pokemon')).toBe('/set/pokemon/base-set')
    expect(
      prettyNodePath({ nodeType: 'artist', label: 'Arita', metadata: {} }, 'pokemon'),
    ).toBeNull()
    expect(prettyNodePath({ ...printing, metadata: {} }, 'pokemon')).toBeNull()
  })

  it('carries depth, view and filters through', () => {
    expect(prettySharePath(printing, params)).toBe(
      '/card/pokemon/charizard-base-set-4?depth=2&view=list&f.rarity=Rare',
    )
    expect(prettySharePath(set, { ...params, depth: 1, view: null, filters: {} })).toBe(
      '/set/pokemon/base-set',
    )
  })
})
