import type { GraphEdge, GraphNeighborhood, GraphNode } from '@constellation/domain'
import type { Lineage } from '@constellation/graph'
import type { Vec3 } from './layout'

export type { Lineage } from '@constellation/graph'

/** Printings drawn per set in the sky (the list shows them all). */
export const LINEAGE_SKY_PRINTINGS_PER_SET = 6
/** Artists drawn in the sky (the most prolific). */
export const LINEAGE_SKY_ARTISTS = 24

/** The sets of a lineage, oldest first (the eras come newest first). */
export function setsOldestFirst(lineage: Lineage) {
  return lineage.eras.flatMap((era) => era.sets.map((entry) => ({ ...entry, series: era.series }))).reverse()
}

/** What the sky draws of a lineage: the family, the series, the sets, a few printings per set, the main artists. */
export function lineageNeighborhood(lineage: Lineage): GraphNeighborhood {
  const nodes = new Map<string, GraphNode>()
  const distances: Record<string, number> = {}
  const add = (node: GraphNode, distance: number) => {
    if (nodes.has(node.id)) return
    nodes.set(node.id, node)
    distances[node.id] = distance
  }
  add(lineage.subject, 0)
  for (const member of lineage.family) add(member.node, 1)
  for (const entry of setsOldestFirst(lineage)) {
    if (entry.series) add(entry.series, 1)
    add(entry.set, 1)
    for (const p of entry.printings.slice(0, LINEAGE_SKY_PRINTINGS_PER_SET)) add(p, 2)
  }
  for (const a of lineage.artists.slice(0, LINEAGE_SKY_ARTISTS)) add(a.node, 2)
  const edges: GraphEdge[] = lineage.edges.filter((e) => nodes.has(e.sourceNodeId) && nodes.has(e.targetNodeId))
  const list = [...nodes.values()]
  return {
    focus: lineage.subject,
    nodes: list,
    edges,
    meta: { depth: 2, truncated: lineage.truncated, nodeCount: list.length, edgeCount: edges.length, distances },
  }
}

/**
 * The lineage as a picture of time: the family in a row on top (base on the left), the sets along
 * a line from the oldest (left) to the newest (right), coiled into a helix when there are many,
 * each set's printings fanned out from it, the series on the spine of their sets, the artists in a
 * row below, under the years they drew.
 */
export function lineageLayout(lineage: Lineage, neighborhood: GraphNeighborhood): Map<string, Vec3> {
  const shown = new Set(neighborhood.nodes.map((n) => n.id))
  const positions = new Map<string, Vec3>()
  const sets = setsOldestFirst(lineage)
  const n = sets.length
  const helix = n > 16
  const radius = helix ? 6 : 0
  const length = helix ? Math.min(96, n * 2.2) : Math.max(0, (n - 1) * 5)
  const dx = n > 1 ? length / (n - 1) : 0
  const axisY = -3
  const minGap = 2.8
  const dTheta = helix ? Math.sqrt(Math.max(0.2, minGap * minGap - dx * dx)) / radius : 0

  // Sets along time.
  const setX = new Map<string, number>()
  sets.forEach((entry, i) => {
    const x = -length / 2 + i * dx
    const theta = i * dTheta
    const radial: Vec3 = helix ? [0, Math.cos(theta), Math.sin(theta)] : [0, 1, 0]
    const at: Vec3 = [x, axisY + radial[1] * radius, radial[2] * radius]
    positions.set(entry.set.id, at)
    setX.set(entry.set.id, x)
    // Printings fan out from their set, away from the axis (below the line when it is straight).
    const out: Vec3 = helix ? radial : [0, -1, 0]
    const printings = entry.printings.filter((p) => shown.has(p.id))
    printings.forEach((p, k) => {
      const reach = 2.2 + Math.floor(k / 2) * 1.6
      const side = k % 2 === 0 ? -0.55 : 0.55
      positions.set(p.id, [at[0] + side * (printings.length > 1 ? 1 : 0), at[1] + out[1] * reach, at[2] + out[2] * reach + (helix ? 0 : side * 0.8)])
    })
  })

  // Series on the spine (on the axis for a helix, above the line otherwise), under their sets.
  const seriesSets = new Map<string, number[]>()
  for (const entry of sets) {
    if (!entry.series) continue
    const xs = seriesSets.get(entry.series.id) ?? []
    xs.push(setX.get(entry.set.id) ?? 0)
    seriesSets.set(entry.series.id, xs)
  }
  for (const [id, xs] of seriesSets) {
    const x = xs.reduce((a, b) => a + b, 0) / xs.length
    positions.set(id, helix ? [x, axisY, 0] : [x, axisY + 4.2, -1.5])
  }

  // The family on top: by stage from left to right, the subject's stage centered on x = 0.
  const subjectStage = lineage.family.find((m) => m.node.id === lineage.subject.id)?.stage ?? 0
  const byStage = new Map<number, string[]>()
  for (const m of lineage.family) byStage.set(m.stage, [...(byStage.get(m.stage) ?? []), m.node.id])
  const topY = axisY + radius + (helix ? 9 : 10)
  for (const [stage, ids] of byStage) {
    ids.forEach((id, k) => {
      const spread = (k - (ids.length - 1) / 2) * 3.2
      positions.set(id, [(stage - subjectStage) * 6, topY + spread * 0.5, spread])
    })
  }
  // A subject outside any family sits in the middle of the top row.
  if (!positions.has(lineage.subject.id)) positions.set(lineage.subject.id, [0, topY, 0])

  // Artists below, under the mean year of what they drew, with room between them.
  const artistX = new Map<string, number>()
  const printingSet = new Map<string, string>()
  for (const entry of sets) for (const p of entry.printings) printingSet.set(p.id, entry.set.id)
  const artistEdges = lineage.edges.filter((e) => e.relationshipType === 'ILLUSTRATED_BY')
  const sums = new Map<string, { sum: number; count: number }>()
  for (const e of artistEdges) {
    const set = printingSet.get(e.sourceNodeId)
    const x = set ? setX.get(set) : undefined
    if (x === undefined) continue
    const s = sums.get(e.targetNodeId) ?? { sum: 0, count: 0 }
    s.sum += x
    s.count += 1
    sums.set(e.targetNodeId, s)
  }
  const artists = lineage.artists.filter((a) => shown.has(a.node.id))
  for (const a of artists) {
    const s = sums.get(a.node.id)
    artistX.set(a.node.id, s ? s.sum / s.count : 0)
  }
  const ordered = [...artistX.entries()].sort((a, b) => a[1] - b[1])
  const gap = 2.6
  let last = -Infinity
  const placed: Array<[string, number]> = []
  for (const [id, x] of ordered) {
    const at = Math.max(x, last + gap)
    placed.push([id, at])
    last = at
  }
  // Re-center the row on its own middle so pushing right does not drift it away.
  const shift = placed.length ? (placed.reduce((acc, [, x]) => acc + x, 0) / placed.length - ordered.reduce((acc, [, x]) => acc + x, 0) / ordered.length) : 0
  const bottomY = axisY - radius - (helix ? 13 : 14)
  for (const [id, x] of placed) positions.set(id, [x - shift, bottomY, 0])

  // Anything left (should not happen) near the subject.
  for (const node of neighborhood.nodes) if (!positions.has(node.id)) positions.set(node.id, [0, axisY, 4])
  return positions
}
