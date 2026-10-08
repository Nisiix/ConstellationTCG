import { describe, expect, it } from 'vitest'
import { fallbackImageUrl, isLogoType, thumbnailUrl } from '../images'

const LOGO = 'https://assets.tcgdex.net/en/base/base1/logo.webp'
const placeholders = { set: LOGO, series: LOGO, game: LOGO }

describe('image fallbacks', () => {
  it('falls back to the standard logo for sets and series', () => {
    expect(fallbackImageUrl({ nodeType: 'set', imageUrl: 'https://assets.tcgdex.net/en/sv/sv01/logo.webp' }, placeholders)).toBe(LOGO)
    expect(fallbackImageUrl({ nodeType: 'series', imageUrl: null }, placeholders)).toBe(LOGO)
  })

  it('never falls back to the image that just failed', () => {
    expect(fallbackImageUrl({ nodeType: 'set', imageUrl: LOGO }, placeholders)).toBeNull()
  })

  it('has no fallback for node types without a placeholder (cards keep their point)', () => {
    expect(fallbackImageUrl({ nodeType: 'card_printing', imageUrl: 'x' }, placeholders)).toBeNull()
    expect(fallbackImageUrl({ nodeType: 'set', imageUrl: null }, {})).toBeNull()
  })

  it('knows which node types carry wide logos and derives thumbnails', () => {
    expect(isLogoType('set')).toBe(true)
    expect(isLogoType('card_printing')).toBe(false)
    expect(thumbnailUrl('https://assets.tcgdex.net/en/base/base1/4/high.webp')).toBe('https://assets.tcgdex.net/en/base/base1/4/low.webp')
    expect(thumbnailUrl(LOGO)).toBe(LOGO)
  })
})
