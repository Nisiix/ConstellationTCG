import { MAX_GRAPH_DEPTH, parseNodeId } from '@constellation/domain'

export type ViewMode = '3d' | 'list'

export interface ExploreParams {
  node: string | null
  depth: number
  view: ViewMode | null
  game: string
  /** Raw filter values keyed by filter id. */
  filters: Record<string, string>
}

export const DEFAULT_GAME = 'pokemon'

/** Parse `/explore` search params. Unknown or malformed values fall back to defaults. */
export function parseExploreParams(params: URLSearchParams): ExploreParams {
  const node = params.get('node')
  const depthParam = params.get('depth')
  const depthRaw = depthParam === null || depthParam.trim() === '' ? NaN : Number(depthParam)
  const depth = Number.isFinite(depthRaw) && depthRaw >= 0 ? Math.min(MAX_GRAPH_DEPTH, Math.floor(depthRaw)) : 1
  const viewRaw = params.get('view')
  const view: ViewMode | null = viewRaw === 'list' ? 'list' : viewRaw === '3d' ? '3d' : null
  const filters: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    if (key.startsWith('f.') && value) filters[key.slice(2)] = value
  }
  return {
    node: node && parseNodeId(node) ? node : null,
    depth,
    view,
    game: params.get('game') ?? DEFAULT_GAME,
    filters,
  }
}

export function buildExploreUrl(params: Partial<ExploreParams>): string {
  const search = new URLSearchParams()
  if (params.node) search.set('node', params.node)
  if (params.depth !== undefined && params.depth !== 1) search.set('depth', String(params.depth))
  if (params.view) search.set('view', params.view)
  if (params.game && params.game !== DEFAULT_GAME) search.set('game', params.game)
  for (const [id, value] of Object.entries(params.filters ?? {})) {
    if (value) search.set(`f.${id}`, value)
  }
  const query = search.toString()
  return query ? `/explore?${query}` : '/explore'
}

/** Stable key of a filter record (used to detect changes). */
export function filtersKey(filters: Record<string, string>): string {
  return Object.keys(filters)
    .sort()
    .map((k) => `${k}=${filters[k]}`)
    .join('&')
}
