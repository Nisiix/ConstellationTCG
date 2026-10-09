import type { GraphEdge, GraphNeighborhood, GraphNode } from '@constellation/domain'
import { humanize } from './colors'

/** What `/api/graph/path` answers (mirrors `GraphPath` in the graph package). */
export interface PathResponse {
  found: boolean
  from: GraphNode
  to: GraphNode
  maxDepth: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  visited: number
  reason?: 'different-games' | 'too-far'
}

/** How a connection reads from its source to its target (`out`) and back (`in`). */
const PHRASES: Record<string, { out: string; in: string }> = {
  ILLUSTRATED_BY: { out: 'illustrated by', in: 'illustrated' },
  BELONGS_TO: { out: 'in', in: 'contains' },
  PART_OF: { out: 'part of', in: 'includes' },
  PRINTING_OF: { out: 'printing of', in: 'printed as' },
  REPRINT_OF: { out: 'reprint of', in: 'reprinted as' },
  EVOLVES_FROM: { out: 'evolves from', in: 'evolves into' },
  EVOLUTION_OF: { out: 'evolution of', in: 'evolves into' },
  SAME_POKEMON: { out: 'shows', in: 'shown on' },
  HAS_TYPE: { out: 'type', in: 'type of' },
  WEAK_TO: { out: 'weak to', in: 'weakness of' },
  RESISTS: { out: 'resists', in: 'resisted by' },
  HAS_ATTRIBUTE: { out: 'is a', in: 'kind of' },
}

/** The connection between two consecutive points, read in the direction of the path. */
export function stepPhrase(edge: GraphEdge, fromId: string): string {
  const phrase = PHRASES[edge.relationshipType]
  const forward = edge.sourceNodeId === fromId
  if (phrase) return forward ? phrase.out : phrase.in
  return humanize(edge.relationshipType).toLowerCase()
}

/** The compact line of one step: "Charizard — illustrated by → Mitsuhiro Arita". */
export function stepLabel(edge: GraphEdge, from: GraphNode, to: GraphNode): string {
  return `${from.label} — ${stepPhrase(edge, from.id)} → ${to.label}`
}

/** The path as a neighborhood for the sky: only its points and connections, around the step in hand. */
export function pathNeighborhood(path: PathResponse, cursorId: string): GraphNeighborhood {
  const index = Math.max(
    0,
    path.nodes.findIndex((n) => n.id === cursorId),
  )
  const focus = path.nodes[index] ?? path.from
  const distances: Record<string, number> = {}
  path.nodes.forEach((node, i) => {
    distances[node.id] = Math.abs(i - index)
  })
  return {
    focus,
    nodes: path.nodes,
    edges: path.edges,
    meta: { depth: 1, truncated: false, nodeCount: path.nodes.length, edgeCount: path.edges.length, distances },
  }
}

/** The step before and after the one in hand (null at the ends). */
export function neighbours(path: PathResponse, cursorId: string): { previous: string | null; next: string | null; index: number } {
  const index = path.nodes.findIndex((n) => n.id === cursorId)
  if (index < 0) return { previous: null, next: path.nodes[0]?.id ?? null, index }
  return { previous: path.nodes[index - 1]?.id ?? null, next: path.nodes[index + 1]?.id ?? null, index }
}
