import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearGraphCache, fetchFocus, focusUrl, isGraphCached, prefetchFocus } from '../api'

const payload = { focus: { id: 'set:x' }, nodes: [], edges: [], meta: {}, summary: [], filtered: false }

describe('graph response cache', () => {
  let calls: string[]
  beforeEach(() => {
    calls = []
    clearGraphCache()
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('fetches a neighborhood once and serves it from the cache afterwards', async () => {
    const a = await fetchFocus('set:x', { depth: 1 })
    const b = await fetchFocus('set:x', { depth: 1 })
    expect(a).toEqual(payload)
    expect(b).toEqual(payload)
    expect(calls).toEqual([focusUrl('set:x', { depth: 1 })])
    expect(isGraphCached(focusUrl('set:x', { depth: 1 }))).toBe(true)
    expect(isGraphCached(focusUrl('set:x', { depth: 2 }))).toBe(false)
  })

  it('dedupes requests in flight and lets a prefetch warm a later fetch', async () => {
    prefetchFocus('set:x', { depth: 1, filters: { rarity: 'Rare' } })
    prefetchFocus('set:x', { depth: 1, filters: { rarity: 'Rare' } })
    await fetchFocus('set:x', { depth: 1, filters: { rarity: 'Rare' } })
    expect(calls).toHaveLength(1)
  })

  it('aborting one consumer does not cancel the shared request', async () => {
    const controller = new AbortController()
    const aborted = fetchFocus('set:y', {}, controller.signal)
    controller.abort()
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
    const later = await fetchFocus('set:y', {})
    expect(later).toEqual(payload)
    expect(calls).toHaveLength(1)
  })

  it('does not cache failures', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ error: { message: 'nope', layer: 'graph' } }), { status: 500 })
    })
    await expect(fetchFocus('set:z')).rejects.toMatchObject({ status: 500 })
    await expect(fetchFocus('set:z')).rejects.toMatchObject({ status: 500 })
    expect(calls).toHaveLength(2)
  })
})
