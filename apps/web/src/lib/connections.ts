import type { GraphEdge, GraphNode, NodeType } from '@constellation/domain'
import { RELATIONSHIP_ORDER, relationshipLabel } from './colors'

/**
 * What counts as a connection in the explorer: other cards (printings and the cards they print),
 * the catalog they belong to (sets, series, the game), the artist and the Pokémon — the ways to the
 * other cards they illustrated or show. The "Node type" filter narrows it down when asked.
 */
export const CONNECTION_NODE_TYPES: NodeType[] = [
  'game',
  'series',
  'set',
  'card_identity',
  'card_printing',
  'pokemon',
  'artist',
]

/** The node types to request for a neighborhood: the person's own filter wins over the default. */
export function connectionNodeTypes(filters: Record<string, string>): NodeType[] | undefined {
  return filters.nodeType ? undefined : CONNECTION_NODE_TYPES
}

/* ── the points further away, sectioned by the connection that brought them in ── */

export interface FarSection {
  key: string
  relationshipType: string
  /** The direct connection the far points came in through; null when no path was found. */
  bridge: GraphNode | null
  /** Which end of the far points' edges the bridge is (`target`: they all point at it, a hub). */
  bridgeIs: 'source' | 'target' | null
  label: string
  nodes: GraphNode[]
}

/** The wording when far points hang from the same hub as the focus (the hub is the edge's target). */
const SHARED_THROUGH: Record<string, string> = {
  PRINTING_OF: 'Same card',
  REPRINT_OF: 'Reprints',
  SAME_POKEMON: 'Same Pokémon',
  ILLUSTRATED_BY: 'Through the artist',
  COUNTERPART_OF: 'Same Pokémon, earlier sets',
}

/**
 * The heading of a far section: what the points share with the focus when they hang from the same
 * hub ("Same set · Base Set", "Through the artist · Mitsuhiro Arita"); otherwise the connection read
 * from the bridge, the way the tooltip phrases it ("Charmeleon → Evolves from").
 */
export function bridgeLabel(relationshipType: string, bridgeIs: 'source' | 'target', bridge: GraphNode): string {
  if (bridgeIs === 'target') {
    const shared =
      relationshipType === 'PART_OF' ? (bridge.nodeType === 'game' ? 'Same game' : 'Same series') : SHARED_THROUGH[relationshipType]
    if (shared) return `${shared} · ${bridge.label}`
  }
  return `${bridge.label} → ${relationshipLabel(relationshipType, bridgeIs === 'source' ? 'out' : 'in')}`
}

interface Route {
  bridge: GraphNode
  relationshipType: string
  bridgeIs: 'source' | 'target'
}

/**
 * Section the points two steps away by the direct connection they came in through: for
 * each far point, the depth-1 neighbour it hangs from and the kind of edge between them (a third
 * step inherits the bridge of the point it hangs from). A point reachable through several bridges
 * goes under the first one only, in the connection order used everywhere else; sections follow
 * that same order, then the bridge's name.
 */
export function groupFarNodes(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  distances: Record<string, number>,
  focusId: string,
): FarSection[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const order = new Map(RELATIONSHIP_ORDER.map((t, i) => [t, i]))
  const rank = (type: string) => order.get(type) ?? RELATIONSHIP_ORDER.length
  const distanceOf = (id: string) => (id === focusId ? 0 : (distances[id] ?? Number.POSITIVE_INFINITY))

  const adjacency = new Map<string, GraphEdge[]>()
  for (const e of edges) {
    adjacency.set(e.sourceNodeId, [...(adjacency.get(e.sourceNodeId) ?? []), e])
    adjacency.set(e.targetNodeId, [...(adjacency.get(e.targetNodeId) ?? []), e])
  }

  const closer = (a: Route, b: Route) =>
    rank(a.relationshipType) - rank(b.relationshipType) || a.bridge.label.localeCompare(b.bridge.label) || a.bridge.id.localeCompare(b.bridge.id)

  const routes = new Map<string, Route | null>()
  const routeOf = (id: string): Route | null => {
    const known = routes.get(id)
    if (known !== undefined) return known
    routes.set(id, null)
    const d = distanceOf(id)
    let best: Route | null = null
    for (const e of adjacency.get(id) ?? []) {
      const otherId = e.sourceNodeId === id ? e.targetNodeId : e.sourceNodeId
      if (distanceOf(otherId) !== d - 1) continue
      const other = byId.get(otherId)
      if (!other) continue
      const candidate: Route | null =
        d === 2 ? { bridge: other, relationshipType: e.relationshipType, bridgeIs: e.sourceNodeId === otherId ? 'source' : 'target' } : routeOf(otherId)
      if (candidate && (!best || closer(candidate, best) < 0)) best = candidate
    }
    routes.set(id, best)
    return best
  }

  const sections = new Map<string, FarSection>()
  for (const node of nodes) {
    const d = distanceOf(node.id)
    if (!Number.isFinite(d) || d < 2) continue
    const route = routeOf(node.id)
    const key = route ? `${route.relationshipType}:${route.bridgeIs}:${route.bridge.id}` : 'other'
    const section =
      sections.get(key) ??
      ({
        key,
        relationshipType: route?.relationshipType ?? 'RELATED_TO',
        bridge: route?.bridge ?? null,
        bridgeIs: route?.bridgeIs ?? null,
        label: route ? bridgeLabel(route.relationshipType, route.bridgeIs, route.bridge) : 'Other connections',
        nodes: [],
      } satisfies FarSection)
    section.nodes.push(node)
    sections.set(key, section)
  }

  const list = [...sections.values()]
  for (const s of list) s.nodes.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
  list.sort(
    (a, b) =>
      Number(a.bridge === null) - Number(b.bridge === null) ||
      rank(a.relationshipType) - rank(b.relationshipType) ||
      (a.bridge?.label ?? '').localeCompare(b.bridge?.label ?? '') ||
      a.key.localeCompare(b.key),
  )
  return list
}
