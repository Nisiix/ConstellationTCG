import { SourceError } from '@constellation/domain'
import { withRetry } from '@constellation/adapters'
import type {
  TCGdexCard,
  TCGdexSerie,
  TCGdexSeriesBrief,
  TCGdexSet,
  TCGdexSetBrief,
} from './types'

export interface TCGdexClientOptions {
  baseUrl?: string
  language?: string
  fetch?: typeof fetch
  retries?: number
  userAgent?: string
  onRetry?: (path: string, attempt: number, error: unknown) => void
}

export const DEFAULT_TCGDEX_BASE_URL = 'https://api.tcgdex.net/v2'

/**
 * Thin REST client for TCGdex. Only used by ingestion workers — never from the browser.
 * Retries on network failures, 429 and 5xx with exponential backoff; 4xx are not retried.
 */
export class TCGdexClient {
  readonly baseUrl: string
  readonly language: string
  private readonly fetchImpl: typeof fetch
  private readonly retries: number
  private readonly userAgent: string
  private readonly onRetry: TCGdexClientOptions['onRetry']

  constructor(options: TCGdexClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_TCGDEX_BASE_URL).replace(/\/+$/, '')
    this.language = options.language ?? 'en'
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.retries = options.retries ?? 4
    this.userAgent = options.userAgent ?? 'constellation-tcg/0.1 (+https://github.com/Nisiix/ConstellationTCG)'
    this.onRetry = options.onRetry
  }

  url(path: string): string {
    return `${this.baseUrl}/${this.language}/${path.replace(/^\/+/, '')}`
  }

  async getJson<T>(path: string): Promise<T> {
    const url = this.url(path)
    return withRetry(
      async () => {
        let response: Response
        try {
          response = await this.fetchImpl(url, {
            headers: { accept: 'application/json', 'user-agent': this.userAgent },
          })
        } catch (error) {
          throw new SourceError(`Network error fetching ${url}`, { url, retryable: true }, { cause: error })
        }
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500
          throw new SourceError(`TCGdex responded ${response.status} for ${url}`, {
            url,
            status: response.status,
            retryable,
          })
        }
        try {
          return (await response.json()) as T
        } catch (error) {
          throw new SourceError(`Invalid JSON from ${url}`, { url, retryable: false }, { cause: error })
        }
      },
      {
        retries: this.retries,
        shouldRetry: (error) => error instanceof SourceError && error.details.retryable === true,
        onRetry: (error, attempt) => this.onRetry?.(path, attempt, error),
      },
    )
  }

  listSeries(): Promise<TCGdexSeriesBrief[]> {
    return this.getJson('series')
  }

  getSerie(id: string): Promise<TCGdexSerie> {
    return this.getJson(`series/${encodeURIComponent(id)}`)
  }

  listSets(): Promise<TCGdexSetBrief[]> {
    return this.getJson('sets')
  }

  getSet(id: string): Promise<TCGdexSet> {
    return this.getJson(`sets/${encodeURIComponent(id)}`)
  }

  getCard(id: string): Promise<TCGdexCard> {
    return this.getJson(`cards/${encodeURIComponent(id)}`)
  }
}
