import { describe, expect, it, vi } from 'vitest'
import { FixtureSource, TCGdexLiveSource } from '../sources'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const briefSets = [
  { id: 'base1', name: 'Base Set', cardCount: { total: 102, official: 102 } },
  { id: 'base2', name: 'Jungle', cardCount: { total: 64, official: 64 } },
]

function fullSet(id: string, name: string) {
  return { id, name, cardCount: { total: 1, official: 1 }, serie: { id: 'base', name: 'Base' }, cards: [] }
}

describe('TCGdexLiveSource.fetchSets', () => {
  it('fetches only the requested sets, without listing the catalog first', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.endsWith('/en/sets')) return jsonResponse(briefSets)
      if (url.endsWith('/en/sets/base1')) return jsonResponse(fullSet('base1', 'Base Set'))
      if (url.endsWith('/en/sets/base2')) return jsonResponse(fullSet('base2', 'Jungle'))
      return jsonResponse({ error: `unexpected ${url}` }, 500)
    })
    const source = new TCGdexLiveSource({ fetch: fetchMock, retries: 0 })

    const one = await source.fetchSets({ ids: ['base1'] })
    expect(one.map((s) => s.id)).toEqual(['base1'])
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual(['https://api.tcgdex.net/v2/en/sets/base1'])

    // No ids: the whole catalog (list, then every set; the one already seen comes from the cache).
    const all = await source.fetchSets()
    expect(all.map((s) => s.id)).toEqual(['base1', 'base2'])
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([
      'https://api.tcgdex.net/v2/en/sets/base1',
      'https://api.tcgdex.net/v2/en/sets',
      'https://api.tcgdex.net/v2/en/sets/base2',
    ])
  })

  it('an empty id list means no set at all (series-only runs)', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const source = new TCGdexLiveSource({ fetch: fetchMock, retries: 0 })
    expect(await source.fetchSets({ ids: [] })).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('FixtureSource.fetchSets', () => {
  it('filters the committed sets by id', async () => {
    const source = new FixtureSource('base1')
    expect((await source.fetchSets()).map((s) => s.id)).toEqual(['base1'])
    expect((await source.fetchSets({ ids: ['base1'] })).map((s) => s.id)).toEqual(['base1'])
    expect(await source.fetchSets({ ids: ['nope'] })).toEqual([])
  })
})
