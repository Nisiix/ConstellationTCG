import type {
  GraphRelationship,
  IdentityResolution,
  ListCardsOptions,
  NormalizedCard,
  RelationshipContext,
  SourceCard,
  SourceSeries,
  SourceSet,
  TCGAdapter,
  TCGDefinition,
} from '@constellation/domain'
import { POKEMON_DEFINITION } from './manifest'
import { normalizeCard } from './normalizer'
import { buildRelationships } from './relationships'
import { resolveIdentity } from './resolver'
import {
  FixtureSource,
  TCGdexLiveSource,
  type PokemonSource,
  type TCGdexLiveSourceOptions,
} from './sources'
import type { TCGdexSerie, TCGdexSet } from './tcgdex/types'

export class PokemonAdapter implements TCGAdapter {
  constructor(readonly source: PokemonSource) {}

  definition(): TCGDefinition {
    return POKEMON_DEFINITION
  }

  async listSeries(): Promise<SourceSeries[]> {
    const series = await this.source.fetchSeries()
    return series.map((s) => toSourceSeries(s))
  }

  async listSets(): Promise<SourceSet[]> {
    const sets = await this.source.fetchSets()
    return sets.map((s) => toSourceSet(s))
  }

  async listCards(options: ListCardsOptions = {}): Promise<SourceCard[]> {
    const cards = await this.source.fetchCards({
      setIds: options.setExternalIds,
      onProgress: options.onProgress,
    })
    return cards.map((card) => ({
      externalId: card.id,
      setExternalId: card.set?.id ?? '',
      language: this.source.language,
      raw: card as unknown as Record<string, unknown>,
    }))
  }

  normalizeCard(card: SourceCard): NormalizedCard {
    return normalizeCard(card)
  }

  resolveIdentity(card: NormalizedCard): IdentityResolution {
    return resolveIdentity(card)
  }

  buildRelationships(context: RelationshipContext): GraphRelationship[] {
    return buildRelationships(context)
  }
}

export function toSourceSeries(serie: TCGdexSerie): SourceSeries {
  const { sets, firstSet, lastSet, ...rest } = serie
  return {
    externalId: serie.id,
    name: serie.name,
    releaseDate: serie.releaseDate ?? null,
    logoUrl: serie.logo ?? null,
    raw: { ...rest, setIds: (sets ?? []).map((s) => s.id) },
  }
}

export function toSourceSet(set: TCGdexSet): SourceSet {
  const { cards, ...rest } = set
  return {
    externalId: set.id,
    seriesExternalId: set.serie?.id ?? '',
    name: set.name,
    releaseDate: set.releaseDate ?? null,
    symbolUrl: set.symbol ?? null,
    logoUrl: set.logo ?? null,
    cardCountTotal: set.cardCount?.total ?? null,
    cardCountOfficial: set.cardCount?.official ?? null,
    raw: { ...rest, cardIds: (cards ?? []).map((c) => c.id) },
  }
}

export function createPokemonAdapter(options: TCGdexLiveSourceOptions = {}): PokemonAdapter {
  return new PokemonAdapter(new TCGdexLiveSource(options))
}

export function createPokemonFixtureAdapter(fixture = 'base1'): PokemonAdapter {
  return new PokemonAdapter(new FixtureSource(fixture))
}
