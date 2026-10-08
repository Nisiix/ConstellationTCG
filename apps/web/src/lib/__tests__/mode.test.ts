import { describe, expect, it } from 'vitest'
import { MODE_BOOT_SCRIPT, MODE_STORAGE_KEY } from '../mode'

/** Run the inline <head> script against a fake browser and return the mode it painted. */
function boot(stored: string | null, systemDark: boolean, broken = false): string | undefined {
  const html: { attrs: Record<string, string>; style: Record<string, string> } = { attrs: {}, style: {} }
  const fakeWindow = {
    matchMedia: broken
      ? () => {
          throw new Error('matchMedia unavailable')
        }
      : (q: string) => ({ matches: q.includes('dark') ? systemDark : !systemDark }),
  }
  const fn = new Function(
    'localStorage',
    'window',
    'document',
    MODE_BOOT_SCRIPT,
  ) as (ls: unknown, w: unknown, d: unknown) => void
  fn(
    { getItem: (key: string) => (key === MODE_STORAGE_KEY ? stored : null) },
    fakeWindow,
    { documentElement: { setAttribute: (k: string, v: string) => (html.attrs[k] = v), style: html.style } },
  )
  return html.attrs['data-mode']
}

describe('mode boot script', () => {
  it('paints the stored preference before the first frame', () => {
    expect(boot('light', true)).toBe('light')
    expect(boot('dark', false)).toBe('dark')
  })

  it('follows the system when nothing (or something stale) is stored', () => {
    expect(boot(null, true)).toBe('dark')
    expect(boot(null, false)).toBe('light')
    expect(boot('neon', false)).toBe('light')
  })

  it('never throws when storage or matchMedia are unavailable', () => {
    expect(() => boot(null, true, true)).not.toThrow()
  })
})
