/**
 * 3D force layout for a focus neighborhood.
 *
 * The focus node is pinned at the origin; every other node is pulled to a spherical shell whose
 * radius grows with its hop distance (a readable "constellation" of concentric rings), while link
 * and charge forces arrange nodes within each shell. Nodes that persist across focus changes keep
 * their previous positions as a starting point so transitions look continuous.
 */
import type { GraphEdge, GraphNode } from '@constellation/domain'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type SimulationLink,
  type SimulationNode,
} from 'd3-force-3d'

export type Vec3 = [number, number, number]

export interface LayoutOptions {
  shellRadius?: number
  iterations?: number
  seed?: number
}

interface LayoutNode extends SimulationNode {
  id: string
  distance: number
  radius: number
}

const DEFAULTS = { shellRadius: 9, iterations: 220 }

/**
 * Simulation ticks for a neighborhood of `count` nodes: the full budget for small ones, fewer
 * for crowds (the force layout runs on the main thread before the first frame; big sets settle
 * well enough with less and the reveal animation hides the rest).
 */
export function adaptiveIterations(count: number): number {
  if (count <= 80) return DEFAULTS.iterations
  return Math.max(90, Math.round(DEFAULTS.iterations - (count - 80) * 0.5))
}

/** Shell radius for a neighborhood of `count` nodes: 9 for small ones, up to ~26 for crowds. */
export function adaptiveShellRadius(count: number): number {
  const extra = Math.sqrt(Math.max(0, count - 12)) * 0.9
  return Math.min(26, DEFAULTS.shellRadius + extra)
}

/** Deterministic pseudo-random generator (mulberry32) so layouts are reproducible. */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function randomOnSphere(random: () => number, radius: number): Vec3 {
  const u = random() * 2 - 1
  const theta = random() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [radius * s * Math.cos(theta), radius * s * Math.sin(theta), radius * u]
}

export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  distances: Record<string, number>,
  focusId: string,
  previous: Map<string, Vec3> = new Map(),
  options: LayoutOptions = {},
): Map<string, Vec3> {
  // Shells grow with the crowd so a set with 200 cards or the whole universe stays readable.
  const shell = options.shellRadius ?? adaptiveShellRadius(nodes.length)
  const iterations = options.iterations ?? adaptiveIterations(nodes.length)
  const random = createRandom(options.seed ?? hashSeed(focusId))
  const index = new Set(nodes.map((n) => n.id))
  const focusPrev = previous.get(focusId)
  const offset: Vec3 = focusPrev ?? [0, 0, 0]

  // Anchor new nodes near a neighbor that already has a position, so they "grow" out of the graph.
  const anchorOf = new Map<string, string>()
  for (const edge of edges) {
    if (!anchorOf.has(edge.targetNodeId) && previous.has(edge.sourceNodeId)) anchorOf.set(edge.targetNodeId, edge.sourceNodeId)
    if (!anchorOf.has(edge.sourceNodeId) && previous.has(edge.targetNodeId)) anchorOf.set(edge.sourceNodeId, edge.targetNodeId)
  }

  const simNodes: LayoutNode[] = nodes.map((node) => {
    const distance = distances[node.id] ?? 1
    const prev = previous.get(node.id)
    let start: Vec3
    if (node.id === focusId) start = offset
    else if (prev) start = prev
    else {
      const anchor = anchorOf.get(node.id)
      const anchorPos = anchor ? previous.get(anchor) : undefined
      const jitter = randomOnSphere(random, 2.5)
      const ring = randomOnSphere(random, shell * Math.max(distance, 1))
      start = anchorPos
        ? [anchorPos[0] + jitter[0], anchorPos[1] + jitter[1], anchorPos[2] + jitter[2]]
        : [ring[0] + offset[0], ring[1] + offset[1], ring[2] + offset[2]]
    }
    const sim: LayoutNode = {
      id: node.id,
      distance,
      radius: node.id === focusId ? 2.2 : distance <= 1 ? 1.4 : 1,
      x: start[0],
      y: start[1],
      z: start[2],
    }
    if (node.id === focusId) {
      sim.fx = offset[0]
      sim.fy = offset[1]
      sim.fz = offset[2]
    }
    return sim
  })

  const links: SimulationLink<LayoutNode>[] = edges
    .filter((e) => index.has(e.sourceNodeId) && index.has(e.targetNodeId))
    .map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId, weight: e.weight }))

  const simulation = forceSimulation<LayoutNode>(simNodes, 3)
    .randomSource(random)
    .alphaDecay(1 - Math.pow(0.001, 1 / iterations))
    .force(
      'link',
      forceLink<LayoutNode, SimulationLink<LayoutNode> & { weight?: number }>(links)
        .id((n) => n.id)
        .distance((l) => shell * 0.9 - (l.weight ?? 0.5) * shell * 0.3)
        .strength((l) => 0.25 + (l.weight ?? 0.5) * 0.35),
    )
    .force('charge', forceManyBody<LayoutNode>().strength(-28).distanceMax(shell * 3))
    .force(
      'radial',
      forceRadial<LayoutNode>((n) => shell * n.distance, offset[0], offset[1], offset[2]).strength((n) =>
        n.distance === 0 ? 1 : 0.55,
      ),
    )
    .force('collide', forceCollide<LayoutNode>((n) => n.radius).iterations(2))
    .stop()

  simulation.tick(iterations)

  const out = new Map<string, Vec3>()
  for (const n of simNodes) out.set(n.id, [n.x ?? 0, n.y ?? 0, n.z ?? 0])
  return out
}

/** Bounding radius of a layout, used to frame the camera. */
export function layoutRadius(positions: Map<string, Vec3>, center: Vec3): number {
  let max = 0
  for (const p of positions.values()) {
    const d = Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])
    if (d > max) max = d
  }
  return max
}
