export interface TCGGame {
  id: string
  slug: string
  name: string
  publisher: string | null
  active: boolean
  adapterKey: string
  createdAt: string
  updatedAt: string
}

export type SourceType = 'api' | 'graphql' | 'web' | 'file'

export interface TCGSource {
  id: string
  gameId: string
  name: string
  type: SourceType
  baseUrl: string | null
  version: string | null
  priority: number
  enabled: boolean
  lastSyncAt: string | null
}

export type SourceHealth = 'healthy' | 'degraded' | 'failed' | 'unknown'
