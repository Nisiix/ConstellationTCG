import type { EntityKind } from './catalog'

export type FilterType = 'select' | 'multi' | 'range' | 'boolean'
export type FilterScope = 'global' | 'game'

export interface FilterValue {
  value: string
  label: string
  count?: number
}

/**
 * Where a filter's values and matching come from. This keeps filters schema-driven: the filters
 * package can compute available values and apply the filter without knowing the game.
 */
export type FilterSource =
  /** A column on card_printings. */
  | { kind: 'column'; column: 'rarity' | 'language' | 'variant' | 'finish' | 'category' }
  /** A key in card_printings.attributes (JSON). `array` means the value is a list. */
  | { kind: 'attribute'; path: string; array?: boolean; numeric?: boolean }
  /** An entity linked through printing_entities. */
  | { kind: 'entity'; entityKind: EntityKind; relation?: string }
  /** A catalog relation (set, series, artist). */
  | { kind: 'relation'; relation: 'set' | 'series' | 'artist' }

export interface FilterDefinition {
  id: string
  label: string
  type: FilterType
  scope: FilterScope
  /** Which node types this filter can narrow. Empty means all. */
  appliesTo?: string[]
  source?: FilterSource
  values?: FilterValue[]
  min?: number
  max?: number
  dependsOn?: string[]
}

/** Active filter selection, keyed by filter id. */
export type FilterSelection = Record<
  string,
  string | string[] | boolean | [number, number] | undefined
>
