import { SourceError } from '@constellation/domain'
import { describe, expect, it, vi } from 'vitest'
import { TCGdexClient } from '../tcgdex/client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('TCGdexClient', () => {
  it('builds language-scoped urls', () => {
    const client = new TCGdexClient({ baseUrl: 'https://api.example/v2/', language: 'fr' })
    expect(client.url('/cards/base1-4')).toBe('https://api.example/v2/fr/cards/base1-4')
  })

  it('retries transient failures and returns the parsed payload', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: 'slow down' }, 429))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1-4', name: 'Charizard' }))
    const onRetry = vi.fn()
    const client = new TCGdexClient({ fetch: fetchMock, retries: 3, onRetry })
    vi.useFakeTimers()
    const promise = client.getCard('base1-4')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    await expect(promise).resolves.toEqual({ id: 'base1-4', name: 'Charizard' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('does not retry client errors such as 404', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'nope' }, 404))
    const client = new TCGdexClient({ fetch: fetchMock, retries: 3 })
    await expect(client.getCard('missing')).rejects.toBeInstanceOf(SourceError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('wraps network failures in SourceError', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    const client = new TCGdexClient({ fetch: fetchMock, retries: 0 })
    await expect(client.listSeries()).rejects.toBeInstanceOf(SourceError)
  })
})
