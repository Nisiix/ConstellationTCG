import type { GraphEdge, GraphNode } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { computeLayout, createRandom, layoutRadius, type Vec3 } from '../layout'

function node(id: string, nodeType: GraphNode['nodeType'] = 'card_printing'): GraphNode {
  return { id, gameId: 'g', nodeType, entityId: id, label: id, subtitle: null, imageUrl: null, metadata: {} }
}

function edge(source: string, target: string, weight = 1): GraphEdge {
  return {
    id: `${source}|R|${target}`,
    sourceNodeId: source,
    targetNodeId: target,
    relationshipType: 'R',
    weight,
    direction: 'directed',
    metadata: {},
  }
}

const focus = node('card_printing:focus')
const ring1 = ['a', 'b', 'c', 'd', 'e'].map((n) => node(`set:${n}`, 'set'))
const ring2 = ['x', 'y', 'z'].map((n) => node(`artist:${n}`, 'artist'))
const nodes = [focus, ...ring1, ...ring2]
const edges = [
  ...ring1.map((n) => edge(focus.id, n.id)),
  ...ring2.map((n, i) => edge(ring1[i % ring1.length]?.id ?? focus.id, n.id, 0.5)),
]
const distances: Record<string, number> = { [focus.id]: 0 }
for (const n of ring1) distances[n.id] = 1
for (const n of ring2) distances[n.id] = 2

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

describe('computeLayout', () => {
  it('pins the focus at the origin and arranges shells by hop distance', () => {
    const positions = computeLayout(nodes, edges, distances, focus.id)
    expect(positions.size).toBe(nodes.length)
    expect(positions.get(focus.id)).toEqual([0, 0, 0])
    const origin: Vec3 = [0, 0, 0]
    const r1 = ring1.map((n) => dist(positions.get(n.id) as Vec3, origin))
    const r2 = ring2.map((n) => dist(positions.get(n.id) as Vec3, origin))
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(avg(r1)).toBeGreaterThan(4)
    expect(avg(r1)).toBeLessThan(16)
    expect(avg(r2)).toBeGreaterThan(avg(r1))
    // nodes never collapse onto each other
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        expect(dist(positions.get(nodes[i]?.id ?? '') as Vec3, positions.get(nodes[j]?.id ?? '') as Vec3)).toBeGreaterThan(0.5)
      }
    }
  })

  it('is deterministic for the same input', () => {
    const a = computeLayout(nodes, edges, distances, focus.id)
    const b = computeLayout(nodes, edges, distances, focus.id)
    expect([...a.entries()]).toEqual([...b.entries()])
  })

  it('keeps the focus where it was so camera flights stay continuous', () => {
    const previous = new Map<string, Vec3>([[focus.id, [10, -4, 3]]])
    const positions = computeLayout(nodes, edges, distances, focus.id, previous)
    expect(positions.get(focus.id)).toEqual([10, -4, 3])
    expect(layoutRadius(positions, [10, -4, 3])).toBeGreaterThan(5)
  })
})

describe('createRandom', () => {
  it('yields a reproducible sequence in [0, 1)', () => {
    const a = createRandom(7)
    const b = createRandom(7)
    const seq = Array.from({ length: 5 }, () => a())
    expect(seq).toEqual(Array.from({ length: 5 }, () => b()))
    expect(seq.every((v) => v >= 0 && v < 1)).toBe(true)
  })
})
