/**
 * Pokémon data sources.
 *
 *  - `TCGdexLiveSource` talks to the TCGdex API (ingestion workers only).
 *  - `FixtureSource` reads JSON fixtures committed under `adapters/pokemon/fixtures/<name>/`, so
 *    tests and the vertical slice run offline and deterministically.
 *
 * Both return payloads already stripped of forbidden fields (prices, marketplace ids).
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapConcurrent } from '@constellation/adapters'
import { SourceError } from '@constellation/domain'
import { TCGdexClient, type TCGdexClientOptions } from './tcgdex/client'
import { stripForbiddenFields } from './tcgdex/strip'
import type { TCGdexCard, TCGdexSerie, TCGdexSet } from './tcgdex/types'

export interface FetchCardsOptions {
  setIds?: string[]
  onProgress?: (fetched: number, total: number) => void
  /** Called when a single card cannot be fetched; the card is skipped. */
  onCardError?: (cardId: string, error: unknown) => void
}

export interface PokemonSource {
  readonly language: string
  fetchSeries(): Promise<TCGdexSerie[]>
  fetchSets(): Promise<TCGdexSet[]>
  fetchCards(options?: FetchCardsOptions): Promise<TCGdexCard[]>
}

export interface TCGdexLiveSourceOptions extends TCGdexClientOptions {
  concurrency?: number
  client?: TCGdexClient
}

export class TCGdexLiveSource implements PokemonSource {
  readonly language: string
  private readonly client: TCGdexClient
  private readonly concurrency: number
  private setCache = new Map<string, TCGdexSet>()

  constructor(options: TCGdexLiveSourceOptions = {}) {
    this.client = options.client ?? new TCGdexClient(options)
    this.language = this.client.language
    this.concurrency = options.concurrency ?? 6
  }

  async fetchSeries(): Promise<TCGdexSerie[]> {
    const brief = await this.client.listSeries()
    const full = await mapConcurrent(brief, this.concurrency, (s) => this.client.getSerie(s.id))
    return full.map((s) => stripForbiddenFields(s))
  }

  async fetchSets(): Promise<TCGdexSet[]> {
    const brief = await this.client.listSets()
    const full = await mapConcurrent(brief, this.concurrency, (s) => this.getSet(s.id))
    return full
  }

  private async getSet(id: string): Promise<TCGdexSet> {
    const cached = this.setCache.get(id)
    if (cached) return cached
    const set = stripForbiddenFields(await this.client.getSet(id))
    this.setCache.set(id, set)
    return set
  }

  async fetchCards(options: FetchCardsOptions = {}): Promise<TCGdexCard[]> {
    const setIds = options.setIds ?? (await this.client.listSets()).map((s) => s.id)
    const sets = await mapConcurrent(setIds, this.concurrency, (id) => this.getSet(id))
    const cardIds = sets.flatMap((s) => s.cards.map((c) => c.id))
    let fetched = 0
    const cards = await mapConcurrent(cardIds, this.concurrency, async (id) => {
      try {
        const card = stripForbiddenFields(await this.client.getCard(id))
        return card
      } catch (error) {
        if (!options.onCardError) throw error
        options.onCardError(id, error)
        return null
      } finally {
        fetched += 1
        options.onProgress?.(fetched, cardIds.length)
      }
    })
    return cards.filter((c): c is TCGdexCard => c !== null)
  }
}

export function fixturesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '../fixtures')
}

export class FixtureSource implements PokemonSource {
  readonly language: string
  private readonly dir: string

  constructor(name = 'base1', options: { language?: string; dir?: string } = {}) {
    this.dir = options.dir ?? path.join(fixturesDir(), name)
    this.language = options.language ?? 'en'
  }

  private async read<T>(file: string): Promise<T> {
    const full = path.join(this.dir, file)
    try {
      return JSON.parse(await readFile(full, 'utf8')) as T
    } catch (error) {
      throw new SourceError(`Cannot read fixture ${full}`, { file: full }, { cause: error })
    }
  }

  fetchSeries(): Promise<TCGdexSerie[]> {
    return this.read('series.json')
  }

  fetchSets(): Promise<TCGdexSet[]> {
    return this.read('sets.json')
  }

  async fetchCards(options: FetchCardsOptions = {}): Promise<TCGdexCard[]> {
    const cards = await this.read<TCGdexCard[]>('cards.json')
    const filtered = options.setIds
      ? cards.filter((c) => options.setIds?.includes(c.set.id))
      : cards
    options.onProgress?.(filtered.length, filtered.length)
    return filtered.map((c) => stripForbiddenFields(c))
  }
}
