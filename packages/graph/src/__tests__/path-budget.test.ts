import { describe, expect, it } from 'vitest'
import { PathIndex, type PathIndexEdge } from '../path'

/**
 * Ticket 09, accepted limits for the path: ≤ 300 ms per path with the index loaded, ≤ 3 s cold;
 * 6 steps by default, 8 on request. The real measure needs the full catalog (ticket 01,
 * `pnpm path:measure`); this guards the in-memory part on a synthetic graph of the same size
 * (~20k printings, ~130k connections), so a regression in the algorithm shows up in CI.
 */

function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function syntheticCatalog() {
  const rand = random(42)
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)]!
  const nodes: Array<{ id: string; nodeType: string }> = [{ id: 'game:g', nodeType: 'game' }]
  const edges: PathIndexEdge[] = []
  let e = 0
  const edge = (source: string, target: string, relationshipType: string) => edges.push({ id: `e${e++}`, source, target, relationshipType })

  const series = Array.from({ length: 20 }, (_, i) => `series:${i}`)
  const sets = Array.from({ length: 170 }, (_, i) => `set:${i}`)
  const artists = Array.from({ length: 400 }, (_, i) => `artist:${i}`)
  const species = Array.from({ length: 1000 }, (_, i) => `pokemon:${i}`)
  const types = Array.from({ length: 11 }, (_, i) => `attribute:${i}`)
  const identities = Array.from({ length: 14000 }, (_, i) => `card_identity:${i}`)
  for (const id of series) nodes.push({ id, nodeType: 'series' }), edge(id, 'game:g', 'PART_OF')
  sets.forEach((id, i) => {
    nodes.push({ id, nodeType: 'set' })
    edge(id, series[Math.floor((i / sets.length) * series.length)]!, 'PART_OF')
  })
  for (const id of artists) nodes.push({ id, nodeType: 'artist' })
  for (const id of species) nodes.push({ id, nodeType: 'pokemon' })
  for (const id of types) nodes.push({ id, nodeType: 'attribute' })
  for (const id of identities) nodes.push({ id, nodeType: 'card_identity' })

  const firstPrinting = new Map<string, string>()
  const printings: string[] = []
  for (let i = 0; i < 20000; i += 1) {
    const id = `card_printing:${i}`
    printings.push(id)
    nodes.push({ id, nodeType: 'card_printing' })
    const identity = i < identities.length ? identities[i]! : pick(identities)
    edge(id, pick(sets), 'BELONGS_TO')
    edge(id, identity, 'PRINTING_OF')
    edge(id, pick(artists), 'ILLUSTRATED_BY')
    edge(id, pick(species), 'SAME_POKEMON')
    edge(id, pick(types), 'HAS_TYPE')
    edge(id, pick(types), 'WEAK_TO')
    const first = firstPrinting.get(identity)
    if (first) edge(id, first, 'REPRINT_OF')
    else firstPrinting.set(identity, id)
  }
  for (let i = 0; i < 3000; i += 1) edge(pick(identities), pick(identities), 'EVOLVES_FROM')
  return { nodes, edges, printings, rand }
}

describe('path budget on a catalog-sized graph', () => {
  it('builds the index within the cold limit and answers paths within the warm limit', () => {
    const { nodes, edges, printings, rand } = syntheticCatalog()
    expect(edges.length).toBeGreaterThan(120_000)

    const coldStart = performance.now()
    const index = new PathIndex(nodes, edges)
    const cold = performance.now() - coldStart
    expect(cold).toBeLessThan(3000)

    const times: number[] = []
    let found = 0
    let longest = 0
    for (let i = 0; i < 100; i += 1) {
      const from = printings[Math.floor(rand() * printings.length)]!
      const to = printings[Math.floor(rand() * printings.length)]!
      const start = performance.now()
      const result = index.find(from, to, { maxDepth: 8 })
      times.push(performance.now() - start)
      if (result.found) {
        found += 1
        longest = Math.max(longest, result.edgeIds.length)
        expect(result.nodeIds.slice(1, -1).some((id) => id.startsWith('game:') || id.startsWith('pokemon:') || id.startsWith('attribute:'))).toBe(false)
      }
    }
    times.sort((a, b) => a - b)
    const p95 = times[94]!
    expect(p95).toBeLessThan(300)
    // Every pair of cards meets within 8 steps through artists, sets and series.
    expect(found).toBe(100)
    expect(longest).toBeLessThanOrEqual(8)
  }, 60_000)
})
