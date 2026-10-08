import { describe, expect, it } from 'vitest'
import { containsForbiddenFields, stripForbiddenFields } from '../tcgdex/strip'

describe('stripForbiddenFields', () => {
  it('removes pricing and marketplace data anywhere in the payload', () => {
    const raw = {
      id: 'base1-4',
      name: 'Charizard',
      updated: '2026-09-04',
      pricing: { cardmarket: { avg: 741 } },
      variants_detailed: [{ type: 'holo', pricing: { tcgplayer: {} }, thirdParty: { tcgplayer: 1 } }],
      set: { id: 'base1', name: 'Base Set', updated: 'keep-me-nested' },
      attacks: [{ name: 'Fire Spin', damage: 100 }],
    }
    const stripped = stripForbiddenFields(raw)
    expect(stripped).toEqual({
      id: 'base1-4',
      name: 'Charizard',
      set: { id: 'base1', name: 'Base Set', updated: 'keep-me-nested' },
      attacks: [{ name: 'Fire Spin', damage: 100 }],
    })
    expect(containsForbiddenFields(raw)).toBe(true)
    expect(containsForbiddenFields(stripped)).toBe(false)
  })

  it('leaves primitives and arrays intact', () => {
    expect(stripForbiddenFields([1, 'a', null])).toEqual([1, 'a', null])
    expect(stripForbiddenFields('x')).toBe('x')
  })
})
