/**
 * Path between two points: the shortest chain of connections, shown step by step.
 *
 * Decisions (`.scratch/fase-2`, research 03 and grilling 06):
 * - in-memory breadth-first search over an adjacency index per game (CSR arrays), loaded once and
 *   reused; recursive CTEs that carry the path array explode and are not used;
 * - fixed bridges: only cards, printings, sets, series and artists are crossed, along
 *   `BELONGS_TO, PART_OF, PRINTING_OF, ILLUSTRATED_BY, REPRINT_OF, EVOLVES_FROM, EVOLUTION_OF`;
 *   the game (and any other kind of point) may only be an end, otherwise every path collapses
 *   into card → set → series → game → series → set → card. An end of any kind is left through any
 *   of its own connections, so every point can be connected;
 * - depth 6 by default, 8 at most; ends in different games have no path;
 * - deterministic: among equally short paths the one preferring reprint, evolution, artist,
 *   card, set, series (then the node id) wins, so `/thread/<a>/<b>` always shows the same path.
 */
import { sql, type Db } from '@constellation/database'
import { GraphError, parseNodeId, type GraphEdge, type GraphNode, type NodeType } from '@constellation/domain'
import { loadNodes } from './neighborhood'
import { rows, toGraphEdge, type EdgeRow } from './rows'

export const PATH_DEFAULT_DEPTH = 6
export const PATH_MAX_DEPTH = 8

/** Points a path may pass through (ends may be anything). */
export const PATH_BRIDGE_NODE_TYPES: readonly NodeType[] = ['series', 'set', 'card_identity', 'card_printing', 'artist']

/** Connections a path may follow between two bridges, in order of preference. */
export const PATH_BRIDGE_RELATIONSHIPS: readonly string[] = [
  'REPRINT_OF',
  'EVOLVES_FROM',
  'EVOLUTION_OF',
  'ILLUSTRATED_BY',
  'PRINTING_OF',
  'BELONGS_TO',
  'PART_OF',
]

const PREFERENCE = new Map<string, number>([
  ['REPRINT_OF', 0],
  ['EVOLVES_FROM', 1],
  ['EVOLUTION_OF', 1],
  ['ILLUSTRATED_BY', 2],
  ['PRINTING_OF', 3],
  ['BELONGS_TO', 4],
  ['PART_OF', 5],
])
const OTHER_PREFERENCE = 9

/* ───────────────────────────── the index ───────────────────────────── */

export interface PathIndexEdge {
  id: string
  source: string
  target: string
  relationshipType: string
}

/**
 * Adjacency of one game's projection in compressed sparse rows: node i's connections are
 * `neighbors[offsets[i] .. offsets[i+1])`, each with its relationship code and edge index.
 */
export class PathIndex {
  readonly ids: string[]
  private readonly position = new Map<string, number>()
  private readonly bridge: Uint8Array
  private readonly offsets: Int32Array
  private readonly neighbors: Int32Array
  private readonly relCode: Uint8Array
  private readonly edgeIndex: Int32Array
  private readonly relNames: string[] = []
  private readonly edgeIds: string[]

  constructor(nodes: ReadonlyArray<{ id: string; nodeType: string }>, edges: ReadonlyArray<PathIndexEdge>) {
    // Sorted ids make the node index order the id order: ties break on it for free.
    const sorted = [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    this.ids = sorted.map((n) => n.id)
    this.bridge = new Uint8Array(sorted.length)
    sorted.forEach((n, i) => {
      this.position.set(n.id, i)
      if ((PATH_BRIDGE_NODE_TYPES as readonly string[]).includes(n.nodeType)) this.bridge[i] = 1
    })

    const relIds = new Map<string, number>()
    const kept: Array<[number, number, number, number]> = []
    this.edgeIds = []
    for (const e of edges) {
      const s = this.position.get(e.source)
      const t = this.position.get(e.target)
      if (s === undefined || t === undefined || s === t) continue
      let code = relIds.get(e.relationshipType)
      if (code === undefined) {
        code = this.relNames.length
        this.relNames.push(e.relationshipType)
        relIds.set(e.relationshipType, code)
      }
      kept.push([s, t, code, this.edgeIds.length])
      this.edgeIds.push(e.id)
    }

    const degree = new Int32Array(sorted.length + 1)
    for (const [s, t] of kept) {
      degree[s + 1]! += 1
      degree[t + 1]! += 1
    }
    this.offsets = new Int32Array(sorted.length + 1)
    for (let i = 0; i < sorted.length; i += 1) this.offsets[i + 1] = this.offsets[i]! + degree[i + 1]!
    const fill = Int32Array.from(this.offsets)
    this.neighbors = new Int32Array(kept.length * 2)
    this.relCode = new Uint8Array(kept.length * 2)
    this.edgeIndex = new Int32Array(kept.length * 2)
    for (const [s, t, code, edge] of kept) {
      const a = fill[s]!++
      this.neighbors[a] = t
      this.relCode[a] = code
      this.edgeIndex[a] = edge
      const b = fill[t]!++
      this.neighbors[b] = s
      this.relCode[b] = code
      this.edgeIndex[b] = edge
    }
  }

  get nodeCount(): number {
    return this.ids.length
  }

  get edgeCount(): number {
    return this.edgeIds.length
  }

  has(id: string): boolean {
    return this.position.has(id)
  }

  /**
   * Shortest path from `from` to `to`, or `found: false` when none exists within `maxDepth`
   * steps (or within the budget of visited points).
   */
  find(from: string, to: string, options: { maxDepth?: number; visitBudget?: number } = {}): PathSearchResult {
    const maxDepth = Math.min(PATH_MAX_DEPTH, Math.max(1, Math.floor(options.maxDepth ?? PATH_DEFAULT_DEPTH)))
    const budget = options.visitBudget ?? 200_000
    const source = this.position.get(from)
    const target = this.position.get(to)
    if (source === undefined || target === undefined) return { found: false, maxDepth, visited: 0, nodeIds: [], edgeIds: [], relationships: [] }
    if (source === target) return { found: true, maxDepth, visited: 1, nodeIds: [from], edgeIds: [], relationships: [] }

    const preferredRels = new Uint8Array(this.relNames.length)
    const bridgeRel = new Uint8Array(this.relNames.length)
    this.relNames.forEach((name, code) => {
      preferredRels[code] = PREFERENCE.get(name) ?? OTHER_PREFERENCE
      bridgeRel[code] = PREFERENCE.has(name) ? 1 : 0
    })
    const isEnd = (i: number) => i === source || i === target
    // An edge may be followed between two bridges along a bridge relationship, or out of an end.
    const traversable = (u: number, slot: number): boolean => {
      const w = this.neighbors[slot]!
      if (!isEnd(w) && !this.bridge[w]) return false
      if (isEnd(u) || isEnd(w)) return true
      return bridgeRel[this.relCode[slot]!] === 1
    }

    // Distances to the target, level by level, until the level that reaches the source is done.
    const distTo = new Int16Array(this.ids.length).fill(-1)
    distTo[target] = 0
    let frontier = [target]
    let visited = 1
    for (let d = 1; d <= maxDepth && frontier.length > 0 && distTo[source] === -1; d += 1) {
      const next: number[] = []
      for (const u of frontier) {
        if (u !== target && !this.bridge[u]) continue
        for (let slot = this.offsets[u]!; slot < this.offsets[u + 1]!; slot += 1) {
          const w = this.neighbors[slot]!
          if (distTo[w] !== -1 || !traversable(u, slot)) continue
          distTo[w] = d
          visited += 1
          if (w !== source) next.push(w)
        }
      }
      if (visited > budget) break
      frontier = next
    }
    if (distTo[source] === -1) return { found: false, maxDepth, visited, nodeIds: [], edgeIds: [], relationships: [] }

    // Walk from the source, one step closer each time, preferring the kinder relationship.
    const nodeIds = [from]
    const edgeIds: string[] = []
    const relationships: string[] = []
    let u: number = source
    while (u !== target) {
      const want = distTo[u]! - 1
      let best = -1
      for (let slot: number = this.offsets[u]!; slot < this.offsets[u + 1]!; slot += 1) {
        const w: number = this.neighbors[slot]!
        if (distTo[w] !== want || !traversable(u, slot)) continue
        if (w !== target && !this.bridge[w]) continue
        if (best === -1) {
          best = slot
          continue
        }
        const pa = preferredRels[this.relCode[slot]!]!
        const pb = preferredRels[this.relCode[best]!]!
        const bw = this.neighbors[best]!
        if (pa < pb || (pa === pb && (w < bw || (w === bw && this.edgeIndex[slot]! < this.edgeIndex[best]!)))) best = slot
      }
      if (best === -1) break // cannot happen: distTo came from these same edges
      u = this.neighbors[best]!
      nodeIds.push(this.ids[u]!)
      edgeIds.push(this.edgeIds[this.edgeIndex[best]!]!)
      relationships.push(this.relNames[this.relCode[best]!]!)
    }
    return { found: true, maxDepth, visited, nodeIds, edgeIds, relationships }
  }
}

export interface PathSearchResult {
  found: boolean
  maxDepth: number
  visited: number
  /** Points of the path, from the first end to the second. */
  nodeIds: string[]
  /** Connections between consecutive points (one fewer than the points). */
  edgeIds: string[]
  relationships: string[]
}

/* ───────────────────────────── loading ───────────────────────────── */

/** Read one game's projection into an index. */
export async function loadPathIndex(db: Db, gameId: string): Promise<PathIndex> {
  const [nodeResult, edgeResult] = await Promise.all([
    db.execute(sql`select id, node_type from graph_nodes where game_id = ${gameId}`),
    db.execute(sql`
      select e.id, e.source_node_id, e.target_node_id, e.relationship_type
      from graph_edges e join graph_nodes n on n.id = e.source_node_id
      where n.game_id = ${gameId}
    `),
  ])
  const nodes = rows<{ id: string; node_type: string }>(nodeResult).map((r) => ({ id: r.id, nodeType: r.node_type }))
  const edges = rows<{ id: string; source_node_id: string; target_node_id: string; relationship_type: string }>(edgeResult).map((r) => ({
    id: r.id,
    source: r.source_node_id,
    target: r.target_node_id,
    relationshipType: r.relationship_type,
  }))
  return new PathIndex(nodes, edges)
}

/**
 * What identifies a build of a game's projection: when it changes the index is stale. Every build
 * rewrites or touches the nodes it keeps and deletes the ones it drops.
 */
export async function pathIndexStamp(db: Db, gameId: string): Promise<string> {
  const result = await db.execute(sql`
    select count(*)::int as nodes, coalesce(max(greatest(created_at, updated_at)), 'epoch'::timestamptz)::text as at,
      (select count(*)::int from graph_edges) as edges
    from graph_nodes where game_id = ${gameId}
  `)
  const row = rows<{ nodes: number; at: string; edges: number }>(result)[0]
  return row ? `${row.nodes}:${row.edges}:${row.at}` : 'empty'
}

/* ───────────────────────────── the answer ───────────────────────────── */

export interface GraphPath {
  found: boolean
  from: GraphNode
  to: GraphNode
  /** The depth the search went to (6 by default, 8 when asked to search further). */
  maxDepth: number
  /** Points of the path in order (empty when not found). */
  nodes: GraphNode[]
  /** Connections between consecutive points, in order. */
  edges: GraphEdge[]
  /** How many points the search looked at. */
  visited: number
  /** Why there is no path, when there is none. */
  reason?: 'different-games' | 'too-far'
}

export interface PathCache {
  get(gameId: string): { stamp: string; checkedAt: number; index: PathIndex } | undefined
  set(gameId: string, entry: { stamp: string; checkedAt: number; index: PathIndex }): void
}

/** A process-wide cache of indexes (kept on `globalThis`, so it survives hot reloads). */
export function processPathCache(): PathCache {
  const ref = globalThis as unknown as { __constellationPathIndex?: Map<string, { stamp: string; checkedAt: number; index: PathIndex }> }
  if (!ref.__constellationPathIndex) ref.__constellationPathIndex = new Map()
  const map = ref.__constellationPathIndex
  return { get: (id) => map.get(id), set: (id, entry) => void map.set(id, entry) }
}

/** The index for a game, rebuilt when its projection changed (checked at most every `recheckMs`). */
export async function getPathIndex(db: Db, gameId: string, cache: PathCache = processPathCache(), recheckMs = 60_000): Promise<PathIndex> {
  const cached = cache.get(gameId)
  const now = Date.now()
  if (cached && now - cached.checkedAt < recheckMs) return cached.index
  const stamp = await pathIndexStamp(db, gameId)
  if (cached && cached.stamp === stamp) {
    cache.set(gameId, { ...cached, checkedAt: now })
    return cached.index
  }
  const index = await loadPathIndex(db, gameId)
  cache.set(gameId, { stamp, checkedAt: now, index })
  return index
}

async function loadEdges(db: Db, ids: string[]): Promise<GraphEdge[]> {
  if (ids.length === 0) return []
  const list = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )
  const result = await db.execute(sql`
    select id, source_node_id, target_node_id, relationship_type, weight, direction, metadata
    from graph_edges where id in (${list})
  `)
  const byId = new Map(rows<EdgeRow>(result).map((r) => [r.id, toGraphEdge(r)]))
  return ids.map((id) => byId.get(id)).filter((e): e is GraphEdge => Boolean(e))
}

/** The path between two points, with the points and connections ready to draw. */
export async function getPath(
  db: Db,
  fromId: string,
  toId: string,
  options: { maxDepth?: number; cache?: PathCache; recheckMs?: number } = {},
): Promise<GraphPath> {
  for (const id of [fromId, toId]) {
    if (!parseNodeId(id)) throw new GraphError(`Invalid node id: ${id}`, { nodeId: id, status: 400 })
  }
  const ends = await loadNodes(db, fromId === toId ? [fromId] : [fromId, toId])
  const from = ends.find((n) => n.id === fromId)
  const to = ends.find((n) => n.id === toId)
  if (!from) throw new GraphError(`Node not found: ${fromId}`, { nodeId: fromId, status: 404 })
  if (!to) throw new GraphError(`Node not found: ${toId}`, { nodeId: toId, status: 404 })
  const maxDepth = Math.min(PATH_MAX_DEPTH, Math.max(1, Math.floor(options.maxDepth ?? PATH_DEFAULT_DEPTH)))

  if (from.gameId !== to.gameId) {
    return { found: false, from, to, maxDepth, nodes: [], edges: [], visited: 0, reason: 'different-games' }
  }

  const index = await getPathIndex(db, from.gameId, options.cache, options.recheckMs)
  const result = index.find(fromId, toId, { maxDepth })
  if (!result.found) return { found: false, from, to, maxDepth, nodes: [], edges: [], visited: result.visited, reason: 'too-far' }

  const [nodeRows, edges] = await Promise.all([loadNodes(db, result.nodeIds), loadEdges(db, result.edgeIds)])
  const byId = new Map(nodeRows.map((n) => [n.id, n]))
  const nodes = result.nodeIds.map((id) => byId.get(id)).filter((n): n is GraphNode => Boolean(n))
  // A path whose points vanished under it (a rebuild between loading and reading): ask again fresh.
  if (nodes.length !== result.nodeIds.length || edges.length !== result.edgeIds.length) {
    if (options.recheckMs === 0) throw new GraphError('The graph changed while the path was read', { status: 503 })
    return getPath(db, fromId, toId, { ...options, recheckMs: 0 })
  }
  return { found: true, from, to, maxDepth, nodes, edges, visited: result.visited }
}
