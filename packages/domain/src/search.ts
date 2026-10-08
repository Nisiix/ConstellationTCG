import type { NodeType } from './graph'

export interface SearchResult {
  nodeId: string
  type: NodeType
  title: string
  subtitle?: string
  image?: string
  score: number
}

export type SearchMatchKind = 'exact' | 'prefix' | 'fuzzy' | 'entity'

export interface SearchQuery {
  q: string
  game?: string
  types?: NodeType[]
  limit?: number
}
