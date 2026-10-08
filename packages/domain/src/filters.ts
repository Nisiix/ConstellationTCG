export type FilterType = 'select' | 'multi' | 'range' | 'boolean'
export type FilterScope = 'global' | 'game'

export interface FilterValue {
  value: string
  label: string
  count?: number
}

export interface FilterDefinition {
  id: string
  label: string
  type: FilterType
  scope: FilterScope
  /** Which node types this filter can narrow. Empty means all. */
  appliesTo?: string[]
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
