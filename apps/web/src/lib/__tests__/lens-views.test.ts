import type { GraphNode } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { landmarksLayout, landmarksNeighborhood, type Landmarks } from '../landmarks-view'
import { LINEAGE_SKY_PRINTINGS_PER_SET, lineageLayout, lineageNeighborhood, setsOldestFirst, type Lineage } from '../lineage-view'

const node = (id: string, nodeType: GraphNode['nodeType'], metadata: Record<string, unknown> = {}): GraphNode => ({
  id,
  gameId: 'g',
  nodeType,
  entityId: id,
  label: id,
  subtitle: null,
  imageUrl: null,
  metadata,
})

function lineageWith(setCount: number, printingsPerSet: number): Lineage {
  const subject = node('pokemon:b', 'pokemon')
  const series = node('series:s', 'series')
  const sets = Array.from({ length: setCount }, (_, i) => {
    const date = `${2000 + i}-01-01`
    const set = node(`set:${i}`, 'set', { releaseDate: date })
    const printings = Array.from({ length: printingsPerSet }, (_, k) => node(`card_printing:${i}-${k}`, 'card_printing', { releaseDate: date }))
    return { set, printings, year: 2000 + i }
  })
  const printings = sets.flatMap((s) => s.printings)
  const artist = node('artist:a', 'artist')
  return {
    from: subject,
    subject,
    family: [
      { node: node('pokemon:a', 'pokemon'), stage: 0, evolvesFrom: [] },
      { node: subject, stage: 1, evolvesFrom: ['pokemon:a'] },
    ],
    printings,
    eras: [{ series, sets: sets.slice().reverse() }],
    artists: [{ node: artist, count: printings.length, firstYear: 2000, lastYear: 2000 + setCount - 1 }],
    first: printings[0] ?? null,
    latest: printings.at(-1) ?? null,
    printingCount: printings.length,
    setCount,
    truncated: false,
    edges: [
      ...printings.map((p) => ({ id: `${p.id}>i`, sourceNodeId: p.id, targetNodeId: artist.id, relationshipType: 'ILLUSTRATED_BY', weight: 1, direction: 'directed' as const, metadata: {} })),
      { id: 'evo', sourceNodeId: subject.id, targetNodeId: 'pokemon:a', relationshipType: 'EVOLUTION_OF', weight: 1, direction: 'directed' as const, metadata: {} },
    ],
  }
}

describe('lineage view', () => {
  it('draws the family, the sets and a few printings per set, and lays time from left to right', () => {
    const lineage = lineageWith(4, 9)
    const hood = lineageNeighborhood(lineage)
    expect(hood.focus.id).toBe('pokemon:b')
    expect(hood.nodes.filter((n) => n.nodeType === 'card_printing')).toHaveLength(4 * LINEAGE_SKY_PRINTINGS_PER_SET)
    expect(hood.edges.every((e) => hood.nodes.some((n) => n.id === e.sourceNodeId) && hood.nodes.some((n) => n.id === e.targetNodeId))).toBe(true)
    const positions = lineageLayout(lineage, hood)
    for (const n of hood.nodes) expect(positions.has(n.id)).toBe(true)
    const xs = setsOldestFirst(lineage).map((s) => positions.get(s.set.id)![0])
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    // The family sits above the sets, the base to the left of its evolution.
    expect(positions.get('pokemon:a')![0]).toBeLessThan(positions.get('pokemon:b')![0])
    expect(positions.get('pokemon:b')![1]).toBeGreaterThan(positions.get('set:0')![1])
  })

  it('coils a long life into a helix that stays within reach of the camera', () => {
    const lineage = lineageWith(60, 1)
    const positions = lineageLayout(lineage, lineageNeighborhood(lineage))
    const xs = [...positions.values()].map((p) => p[0])
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(110)
    const zs = setsOldestFirst(lineage).map((s) => positions.get(s.set.id)![2])
    expect(zs.some((z) => Math.abs(z) > 1)).toBe(true)
  })
})

describe('landmarks view', () => {
  it('puts the game in the middle and every landmark around it, joined in its category color', () => {
    const game = node('game:p', 'game')
    const landmarks: Landmarks = {
      game,
      categories: [
        { id: 'eras', title: 'Eras', description: '', relationshipType: 'PART_OF', items: [{ node: node('set:a', 'set'), value: 0, reason: 'Opened' }] },
        {
          id: 'crossroads',
          title: 'Crossroads',
          description: '',
          relationshipType: 'SHARED_SUBJECTS',
          items: [
            { node: node('set:a', 'set'), value: 3, reason: 'Bridged' },
            { node: node('set:b', 'set'), value: 2, reason: 'Bridged' },
          ],
        },
      ],
    }
    const hood = landmarksNeighborhood(landmarks)
    expect(hood.nodes.map((n) => n.id)).toEqual(['game:p', 'set:a', 'set:b'])
    expect(hood.edges.map((e) => e.relationshipType)).toEqual(['PART_OF', 'SHARED_SUBJECTS', 'SHARED_SUBJECTS'])
    const positions = landmarksLayout(landmarks)
    expect(positions.get('game:p')).toEqual([0, 0, 0])
    expect(positions.size).toBe(3)
    // The eras sit at the top of the ring.
    expect(positions.get('set:a')![1]).toBeGreaterThan(8)
  })
})
