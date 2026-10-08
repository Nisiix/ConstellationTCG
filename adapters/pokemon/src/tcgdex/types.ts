/**
 * Shapes of the TCGdex REST API (v2) payloads we consume. Deliberately loose: the source can add
 * fields at any time and the normalizer only reads what it understands.
 */

export interface TCGdexSeriesBrief {
  id: string
  name: string
  logo?: string
}

export interface TCGdexCardCount {
  total: number
  official: number
  firstEd?: number
  holo?: number
  normal?: number
  reverse?: number
}

export interface TCGdexSetBrief {
  id: string
  name: string
  logo?: string
  symbol?: string
  cardCount: TCGdexCardCount
}

export interface TCGdexSerie extends TCGdexSeriesBrief {
  releaseDate?: string
  sets: TCGdexSetBrief[]
  firstSet?: TCGdexSetBrief
  lastSet?: TCGdexSetBrief
}

export interface TCGdexCardBrief {
  id: string
  localId: string
  name: string
  image?: string
}

export interface TCGdexSet extends TCGdexSetBrief {
  releaseDate?: string
  serie: { id: string; name: string }
  cards: TCGdexCardBrief[]
  legal?: { standard?: boolean; expanded?: boolean }
  tcgOnline?: string
  abbreviation?: { official?: string; local?: string }
}

export interface TCGdexVariants {
  firstEdition?: boolean
  holo?: boolean
  normal?: boolean
  reverse?: boolean
  wPromo?: boolean
}

export interface TCGdexAbility {
  type?: string
  name: string
  effect?: string
}

export interface TCGdexAttack {
  cost?: string[]
  name: string
  effect?: string
  damage?: number | string
}

export interface TCGdexWeakRes {
  type: string
  value?: string
}

export interface TCGdexCard extends TCGdexCardBrief {
  category: 'Pokemon' | 'Trainer' | 'Energy' | string
  illustrator?: string
  rarity?: string
  set: TCGdexSetBrief
  variants?: TCGdexVariants
  dexId?: number[]
  hp?: number
  types?: string[]
  evolveFrom?: string
  description?: string
  stage?: string
  suffix?: string
  level?: number | string
  abilities?: TCGdexAbility[]
  attacks?: TCGdexAttack[]
  weaknesses?: TCGdexWeakRes[]
  resistances?: TCGdexWeakRes[]
  retreat?: number
  regulationMark?: string
  legal?: { standard?: boolean; expanded?: boolean }
  trainerType?: string
  energyType?: string
  effect?: string
  item?: { name?: string; effect?: string }
  /** Volatile / forbidden fields that are stripped before anything is stored. */
  updated?: string
  pricing?: unknown
  variants_detailed?: unknown
  [key: string]: unknown
}
