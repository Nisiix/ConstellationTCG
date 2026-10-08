/**
 * Canonical catalog model.
 *
 *   GAME -> SERIES -> SET -> CARD_IDENTITY -> CARD_PRINTING
 *
 * A CardIdentity is the concept of a card ("Charizard"). A CardPrinting is one concrete
 * manifestation (Base Set, 4/102, English, holo). One identity has many printings.
 */

export interface Provenance {
  sourceId: string
  sourceRecordId: string
  rawHash: string
}

export interface Series {
  id: string
  gameId: string
  externalId: string
  slug: string
  name: string
  releaseDate: string | null
  logoUrl: string | null
  sourceId: string
  rawHash: string
  createdAt: string
  updatedAt: string
}

export interface CardSet {
  id: string
  gameId: string
  seriesId: string
  externalId: string
  slug: string
  name: string
  releaseDate: string | null
  symbolUrl: string | null
  logoUrl: string | null
  cardCountTotal: number | null
  cardCountOfficial: number | null
  sourceId: string
  rawHash: string
  createdAt: string
  updatedAt: string
}

/** What kind of thing a card identity represents. Game-agnostic. */
export type IdentityEntityType = 'character' | 'trainer' | 'energy' | 'item' | 'other'

export interface CardIdentity {
  id: string
  gameId: string
  canonicalName: string
  normalizedName: string
  entityType: IdentityEntityType
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface Artist {
  id: string
  name: string
  normalizedName: string
}

/** Printing finish. Adapters map their own vocabulary onto this. */
export type Finish = 'normal' | 'holo' | 'reverse' | 'other'

export interface CardPrinting {
  id: string
  identityId: string
  setId: string
  externalId: string
  collectorNumber: string
  printedNumber: string | null
  language: string
  category: string | null
  rarity: string | null
  variant: string
  finish: Finish
  artistId: string | null
  imageFront: string | null
  imageBack: string | null
  releaseDate: string | null
  /** Adapter-specific normalized attributes (e.g. Pokemon hp/types/attacks). */
  attributes: Record<string, unknown>
  rawDataHash: string
  sourceId: string
  createdAt: string
  updatedAt: string
}

/**
 * Semantic entities that are not cards: a Pokemon species, an energy type, a mechanic...
 * They become graph nodes of their own (`pokemon`, `attribute`, `mechanic`).
 */
export type EntityKind = 'pokemon' | 'attribute' | 'mechanic'

export interface Entity {
  id: string
  gameId: string
  kind: EntityKind
  /** Stable key within (gameId, kind), e.g. `dex:6` or `type:fire`. */
  key: string
  name: string
  normalizedName: string
  metadata: Record<string, unknown>
}

export interface ExternalId {
  id: string
  entityType: 'series' | 'set' | 'card_identity' | 'card_printing' | 'artist' | 'entity'
  entityId: string
  source: string
  externalId: string
}
