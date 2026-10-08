import { describe, expect, it } from 'vitest'
import { filterParams, intParam, listParam } from '../params'

describe('intParam', () => {
  it('falls back when the parameter is missing or empty (regression: Number(null) is 0)', () => {
    expect(intParam(null, 300, 1, 1000)).toBe(300)
    expect(intParam(undefined, 300, 1, 1000)).toBe(300)
    expect(intParam('', 300, 1, 1000)).toBe(300)
    expect(intParam('  ', 1, 0, 3)).toBe(1)
  })

  it('parses, floors and clamps numbers', () => {
    expect(intParam('2', 1, 0, 3)).toBe(2)
    expect(intParam('2.9', 1, 0, 3)).toBe(2)
    expect(intParam('99', 1, 0, 3)).toBe(3)
    expect(intParam('-5', 1, 0, 3)).toBe(0)
    expect(intParam('abc', 7, 0, 10)).toBe(7)
  })
})

describe('listParam', () => {
  it('splits comma lists and drops blanks', () => {
    expect(listParam('a, b,,c')).toEqual(['a', 'b', 'c'])
    expect(listParam('')).toBeNull()
    expect(listParam(null)).toBeNull()
    expect(listParam(' , ')).toBeNull()
  })
})

describe('filterParams', () => {
  it('collects f.* parameters only', () => {
    const params = new URLSearchParams('f.rarity=Rare&f.pokemon.type=Fire%2CWater&depth=2&f.empty=')
    expect(filterParams(params)).toEqual({ rarity: 'Rare', 'pokemon.type': 'Fire,Water' })
  })
})
