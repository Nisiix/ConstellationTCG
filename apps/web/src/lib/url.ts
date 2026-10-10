import { MAX_GRAPH_DEPTH, parseNodeId } from '@constellation/domain'

export type ViewMode = '3d' | 'list'

/**
 * A page opened over the explorer, with its own address so Back returns to where it was opened:
 * the focus's details, or every connection of one kind (of the focus, or of `of`).
 */
export type ExplorePanel =
  | { kind: 'details' }
  | { kind: 'list'; relationshipType: string; direction: 'out' | 'in'; of: string | null }

/**
 * A dedicated view over the sky: the lineage of the point in hand (`lens=lineage`) or the
 * landmarks of the game (`lens=landmarks`).
 */
export type ExploreLens = 'lineage' | 'landmarks'

/** The years the time cursor accepts. */
export const TIME_MIN_YEAR = 1990
export const TIME_MAX_YEAR = 2100

export interface ExploreParams {
  node: string | null
  depth: number
  view: ViewMode | null
  game: string
  /** Raw filter values keyed by filter id. */
  filters: Record<string, string>
  /** The two ends of a path being shown (`path=<a>,<b>`), or null outside path mode. */
  path: [string, string] | null
  /** How far the path search goes when asked to search further (`max=8`); null = default (6). */
  pathMax: number | null
  /** A page over the explorer (`panel=details`, `panel=list&rel=…&dir=…[&of=…]`); null = none. */
  panel: ExplorePanel | null
  /** The sky as it stood at the end of a year (`year=1999`); null = all of time. */
  year: number | null
  /** A dedicated view (`lens=lineage` on a point, `lens=landmarks`); null = the sky itself. */
  lens: ExploreLens | null
}

function parsePanel(params: URLSearchParams): ExplorePanel | null {
  const panel = params.get('panel')
  if (panel === 'details') return { kind: 'details' }
  if (panel !== 'list') return null
  const relationshipType = params.get('rel') ?? ''
  const direction = params.get('dir')
  if (!/^[A-Z][A-Z_]{0,63}$/.test(relationshipType) || (direction !== 'out' && direction !== 'in')) return null
  const of = params.get('of')
  return { kind: 'list', relationshipType, direction, of: of && parseNodeId(of) ? of : null }
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
  const ends = (params.get('path') ?? '').split(',')
  const path: [string, string] | null =
    ends.length === 2 && parseNodeId(ends[0] ?? '') && parseNodeId(ends[1] ?? '') ? [ends[0]!, ends[1]!] : null
  const yearRaw = Number(params.get('year'))
  const year = Number.isInteger(yearRaw) && yearRaw >= TIME_MIN_YEAR && yearRaw <= TIME_MAX_YEAR ? yearRaw : null
  const lensRaw = params.get('lens')
  const nodeOk = Boolean(node && parseNodeId(node))
  // A lineage needs a point; a path is a view of its own.
  const lens: ExploreLens | null = path ? null : lensRaw === 'landmarks' ? 'landmarks' : lensRaw === 'lineage' && nodeOk ? 'lineage' : null
  const maxRaw = Number(params.get('max'))
  const pathMax = path && Number.isFinite(maxRaw) && maxRaw >= 1 ? Math.min(PATH_DEPTH_LIMIT, Math.floor(maxRaw)) : null
  return {
    node: node && parseNodeId(node) ? node : path ? path[0] : null,
    depth,
    view,
    game: params.get('game') ?? DEFAULT_GAME,
    filters,
    path,
    pathMax,
    panel: parsePanel(params),
    year,
    lens,
  }
}

/** The deepest a path search may go (mirrors `PATH_MAX_DEPTH` in the graph package). */
export const PATH_DEPTH_LIMIT = 8

export function buildExploreUrl(params: Partial<ExploreParams>): string {
  const search = new URLSearchParams()
  if (params.node) search.set('node', params.node)
  if (params.depth !== undefined && params.depth !== 1) search.set('depth', String(params.depth))
  if (params.view) search.set('view', params.view)
  if (params.game && params.game !== DEFAULT_GAME) search.set('game', params.game)
  for (const [id, value] of Object.entries(params.filters ?? {})) {
    if (value) search.set(`f.${id}`, value)
  }
  if (params.path) {
    search.set('path', params.path.join(','))
    if (params.pathMax) search.set('max', String(params.pathMax))
  }
  if (params.lens && !params.path && (params.lens === 'landmarks' || params.node)) search.set('lens', params.lens)
  if (params.year) search.set('year', String(params.year))
  if (params.panel?.kind === 'details') search.set('panel', 'details')
  if (params.panel?.kind === 'list') {
    search.set('panel', 'list')
    search.set('rel', params.panel.relationshipType)
    search.set('dir', params.panel.direction)
    if (params.panel.of) search.set('of', params.panel.of)
  }
  const query = search.toString()
  return query ? `/explore?${query}` : '/explore'
}

/** The shareable address of a path: its two ends, and the list view when that is what was open. */
export function threadPath(from: string, to: string, view?: ViewMode | null): string {
  const base = `/thread/${encodeURIComponent(from)}/${encodeURIComponent(to)}`
  return view === 'list' ? `${base}?view=list` : base
}

/** Stable key of a filter record (used to detect changes). */
export function filtersKey(filters: Record<string, string>): string {
  return Object.keys(filters)
    .sort()
    .map((k) => `${k}=${filters[k]}`)
    .join('&')
}
