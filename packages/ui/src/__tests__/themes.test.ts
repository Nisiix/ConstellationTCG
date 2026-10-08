import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, ONE_PIECE_THEME, edgeColor, hexToRgb, nodeColor, resolveTheme, themeCssVariables } from '../themes'

describe('themes', () => {
  it('One Piece preset uses deep blue and violet for contours', () => {
    expect(ONE_PIECE_THEME.primary.toLowerCase()).toBe('#2e49c9')
    expect(ONE_PIECE_THEME.accent.toLowerCase()).toBe('#8b6cf6')
    expect(ONE_PIECE_THEME.modes.dark.contrast.toLowerCase()).toBe('#f4f5ff')
  })

  it('resolves roles per mode: contrast flips between near-white and near-black', () => {
    const dark = resolveTheme(DEFAULT_THEME, 'dark')
    const light = resolveTheme(DEFAULT_THEME, 'light')
    expect(dark.nodes.card_identity).toBe(dark.contrast)
    expect(light.nodes.card_identity).toBe(light.contrast)
    expect(dark.contrast).not.toBe(light.contrast)
    expect(dark.background).not.toBe(light.background)
    // Backgrounds are neutral: brand colors never become fills.
    expect(dark.background).not.toBe(DEFAULT_THEME.primary)
    expect(light.nodeFill).not.toBe(DEFAULT_THEME.primary)
  })

  it('falls back to the muted contour for unknown node and edge types', () => {
    const op = resolveTheme(ONE_PIECE_THEME, 'dark')
    expect(nodeColor(op, 'pokemon')).toBe(op.muted)
    expect(nodeColor(op, 'set')).toBe(ONE_PIECE_THEME.primary)
    expect(edgeColor(op, 'SAME_POKEMON')).toBe(op.muted)
    expect(edgeColor(op, 'PART_OF')).toBe(ONE_PIECE_THEME.accent)
  })

  it('exposes every palette entry as a CSS variable', () => {
    const vars = themeCssVariables(resolveTheme(DEFAULT_THEME, 'dark'))
    expect(vars['--c-primary']).toBe(DEFAULT_THEME.primary)
    expect(vars['--c-bg']).toBe(DEFAULT_THEME.modes.dark.background)
    expect(vars['--c-node-fill']).toBe(DEFAULT_THEME.modes.dark.nodeFill)
    expect(Object.keys(vars)).toHaveLength(10)
  })

  it('parses hex colors', () => {
    expect(hexToRgb('#ffffff')).toEqual([1, 1, 1])
    expect(hexToRgb('#000')).toEqual([0, 0, 0])
    expect(hexToRgb('#e3242b').map((v) => Math.round(v * 255))).toEqual([227, 36, 43])
    expect(hexToRgb('rgba(1,2,3,0.5)')).toEqual([1, 1, 1])
  })
})
