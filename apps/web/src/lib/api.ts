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

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
  return parse<T>(response)
}

/** A request with a JSON body (account, wallet and ownership routes); same errors as `request`. */
export async function send<T>(url: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const hasBody = options.body !== undefined
  const response = await fetch(url, {
    method: options.method ?? 'POST',
    signal: options.signal,
    headers: { accept: 'application/json', ...(hasBody ? { 'content-type': 'application/json' } : {}) },
    body: hasBody ? JSON.stringify(options.body) : undefined,
  })
  return parse<T>(response)
}

async function parse<T>(response: Response): Promise<T> {
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

/**
 * Small client-side cache for graph responses (neighborhoods, universe). Data only changes when
 * ingestion runs, so a short TTL is safe. It lets the explorer prefetch the points around the
 * focus and whatever is under the pointer, so following a connection is instant, and it dedupes
 * requests in flight. Aborting one consumer never cancels the shared request.
 */
interface CacheEntry<T> {
  promise: Promise<T>
  storedAt: number
}

const GRAPH_CACHE_TTL = 2 * 60_000
const GRAPH_CACHE_MAX = 80
const graphCache = new Map<string, CacheEntry<unknown>>()

function abortError(): Error {
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

/** Resolve with the cached response (fetching it once), honoring the caller's abort signal. */
function cached<T>(url: string, signal?: AbortSignal): Promise<T> {
  const now = Date.now()
  let entry = graphCache.get(url) as CacheEntry<T> | undefined
  if (entry && now - entry.storedAt > GRAPH_CACHE_TTL) {
    graphCache.delete(url)
    entry = undefined
  }
  if (!entry) {
    const promise = request<T>(url).catch((error: unknown) => {
      graphCache.delete(url)
      throw error
    })
    entry = { promise, storedAt: now }
    graphCache.set(url, entry)
    if (graphCache.size > GRAPH_CACHE_MAX) {
      const oldest = graphCache.keys().next().value
      if (oldest !== undefined) graphCache.delete(oldest)
    }
  } else {
    // refresh recency
    graphCache.delete(url)
    graphCache.set(url, entry)
  }
  if (!signal) return entry.promise
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    entry!.promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

export function clearGraphCache(): void {
  graphCache.clear()
}

export function isGraphCached(url: string): boolean {
  const entry = graphCache.get(url)
  return Boolean(entry && Date.now() - entry.storedAt <= GRAPH_CACHE_TTL)
}

export interface FocusRequest {
  depth?: number
  limit?: number
  /** Max neighbors expanded per node (hubs). */
  perNode?: number
  relationshipTypes?: string[]
  nodeTypes?: NodeType[]
  /** Raw filter values keyed by filter id (serialized as `f.<id>`). */
  filters?: Record<string, string>
}

export function focusQuery(options: FocusRequest): string {
  const params = new URLSearchParams()
  if (options.depth !== undefined) params.set('depth', String(options.depth))
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  if (options.perNode !== undefined) params.set('perNode', String(options.perNode))
  if (options.relationshipTypes?.length) params.set('relationshipTypes', options.relationshipTypes.join(','))
  if (options.nodeTypes?.length) params.set('nodeTypes', options.nodeTypes.join(','))
  for (const [id, value] of Object.entries(options.filters ?? {})) {
    if (value) params.set(`f.${id}`, value)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function focusUrl(nodeId: string, options: FocusRequest = {}): string {
  return `/api/graph/focus/${encodeURIComponent(nodeId)}${focusQuery(options)}`
}

export function universeUrl(game: string): string {
  return `/api/graph/universe?game=${encodeURIComponent(game)}`
}

export function fetchFocus(nodeId: string, options: FocusRequest = {}, signal?: AbortSignal) {
  return cached<FocusResponse>(focusUrl(nodeId, options), signal)
}

/** Warm the cache for a node the visitor may fly to next. Never throws. */
export function prefetchFocus(nodeId: string, options: FocusRequest = {}): void {
  const url = focusUrl(nodeId, options)
  if (isGraphCached(url)) return
  cached<FocusResponse>(url).catch(() => {})
}

export function fetchUniverse(game: string, signal?: AbortSignal) {
  return cached<GraphNeighborhood>(universeUrl(game), signal)
}

export function fetchNode(nodeId: string, signal?: AbortSignal) {
  return request<{ node: GraphNode; summary: RelationshipSummary[] }>(
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
  return request<{ results: SearchHit[] }>(`/api/search?${params.toString()}`, signal)
}

export function fetchFilters(game: string, signal?: AbortSignal) {
  return request<{ game: string; filters: FilterDefinition[] }>(
    `/api/filters?game=${encodeURIComponent(game)}`,
    signal,
  )
}

export interface GameSummary {
  slug: string
  name: string
  publisher: string | null
  theme: TCGTheme
  /** Stand-in images per node type (e.g. the classic Pokémon logo for sets without one). */
  placeholderImages: Partial<Record<NodeType, string>>
  available: boolean
}

export function fetchGames(signal?: AbortSignal) {
  return request<{ games: GameSummary[] }>('/api/games', signal)
}
