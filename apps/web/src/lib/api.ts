import type {
  FilterDefinition,
  GraphNeighborhood,
  GraphNode,
  NodeType,
  RelationshipSummary,
  TCGTheme,
} from '@constellation/domain'
import type { SearchHit } from '@constellation/search'

export interface FocusResponse extends GraphNeighborhood {
  summary: RelationshipSummary[]
  filtered: boolean
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly layer: string = 'unknown',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    let layer = 'unknown'
    try {
      const body = (await response.json()) as { error?: { message?: string; layer?: string } }
      message = body.error?.message ?? message
      layer = body.error?.layer ?? layer
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status, layer)
  }
  return (await response.json()) as T
}

export interface FocusRequest {
  depth?: number
  limit?: number
  relationshipTypes?: string[]
  nodeTypes?: NodeType[]
  /** Raw filter values keyed by filter id (serialized as `f.<id>`). */
  filters?: Record<string, string>
}

export function focusQuery(options: FocusRequest): string {
  const params = new URLSearchParams()
  if (options.depth !== undefined) params.set('depth', String(options.depth))
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  if (options.relationshipTypes?.length) params.set('relationshipTypes', options.relationshipTypes.join(','))
  if (options.nodeTypes?.length) params.set('nodeTypes', options.nodeTypes.join(','))
  for (const [id, value] of Object.entries(options.filters ?? {})) {
    if (value) params.set(`f.${id}`, value)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function fetchFocus(nodeId: string, options: FocusRequest = {}, signal?: AbortSignal) {
  return get<FocusResponse>(`/api/graph/focus/${encodeURIComponent(nodeId)}${focusQuery(options)}`, signal)
}

export function fetchUniverse(game: string, signal?: AbortSignal) {
  return get<GraphNeighborhood>(`/api/graph/universe?game=${encodeURIComponent(game)}`, signal)
}

export function fetchNode(nodeId: string, signal?: AbortSignal) {
  return get<{ node: GraphNode; summary: RelationshipSummary[] }>(
    `/api/graph/node/${encodeURIComponent(nodeId)}`,
    signal,
  )
}

export function fetchSearch(
  q: string,
  options: { game?: string; types?: NodeType[]; limit?: number } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ q })
  if (options.game) params.set('game', options.game)
  if (options.types?.length) params.set('type', options.types.join(','))
  if (options.limit) params.set('limit', String(options.limit))
  return get<{ results: SearchHit[] }>(`/api/search?${params.toString()}`, signal)
}

export function fetchFilters(game: string, signal?: AbortSignal) {
  return get<{ game: string; filters: FilterDefinition[] }>(
    `/api/filters?game=${encodeURIComponent(game)}`,
    signal,
  )
}

export interface GameSummary {
  slug: string
  name: string
  publisher: string | null
  theme: TCGTheme
  available: boolean
}

export function fetchGames(signal?: AbortSignal) {
  return get<{ games: GameSummary[] }>('/api/games', signal)
}
