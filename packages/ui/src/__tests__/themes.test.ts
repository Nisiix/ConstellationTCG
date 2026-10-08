import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, ONE_PIECE_THEME, edgeColor, hexToRgb, nodeColor, themeCssVariables } from '../themes'

describe('themes', () => {
  it('One Piece preset is deep blue, violet and white', () => {
    expect(ONE_PIECE_THEME.primary.toLowerCase()).toBe('#2f4fd8')
    expect(ONE_PIECE_THEME.accent.toLowerCase()).toBe('#a78bfa')
    expect(ONE_PIECE_THEME.secondary.toLowerCase()).toBe('#ffffff')
    expect(ONE_PIECE_THEME.background).not.toBe(DEFAULT_THEME.background)
  })

  it('falls back to brand colors for unknown node and edge types', () => {
    expect(nodeColor(ONE_PIECE_THEME, 'pokemon')).toBe(ONE_PIECE_THEME.secondary)
    expect(nodeColor(DEFAULT_THEME, 'set')).toBe('#3b82f6')
    expect(edgeColor(ONE_PIECE_THEME, 'SAME_POKEMON')).toBe(ONE_PIECE_THEME.primary)
    expect(edgeColor(DEFAULT_THEME, 'PART_OF')).toBe('#a78bfa')
  })

  it('exposes every palette entry as a CSS variable', () => {
    const vars = themeCssVariables(DEFAULT_THEME)
    expect(vars['--c-primary']).toBe(DEFAULT_THEME.primary)
    expect(vars['--c-bg']).toBe(DEFAULT_THEME.background)
    expect(Object.keys(vars)).toHaveLength(9)
  })

  it('parses hex colors', () => {
    expect(hexToRgb('#ffffff')).toEqual([1, 1, 1])
    expect(hexToRgb('#000')).toEqual([0, 0, 0])
    expect(hexToRgb('#ff2f45').map((v) => Math.round(v * 255))).toEqual([255, 47, 69])
    expect(hexToRgb('rgba(1,2,3,0.5)')).toEqual([1, 1, 1])
  })
})
