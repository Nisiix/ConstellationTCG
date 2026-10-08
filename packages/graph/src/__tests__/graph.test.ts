import { graphEdges, graphNodes, type Database } from '@constellation/database'
import { GraphError } from '@constellation/domain'
import { createSeededDatabase } from '@constellation/testing'
import type { AdapterRegistry } from '@constellation/adapters'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildGraphProjection, type BuildReport } from '../builder'
import { getNeighborhood } from '../neighborhood'
import { getGraphStats, getRelationshipSummary } from '../node'
import { getUniverse } from '../universe'

let database: Database
let registry: AdapterRegistry
let report: BuildReport

beforeAll(async () => {
  const seeded = await createSeededDatabase()
  database = seeded.database
  registry = seeded.registry
  report = await buildGraphProjection({ database, registry })
})

afterAll(async () => {
  await database.close()
})

async function findNode(nodeType: string, label: string) {
  const all = await database.db.select().from(graphNodes)
  const node = all.find((n) => n.nodeType === nodeType && n.label === label)
  if (!node) throw new Error(`node ${nodeType} "${label}" not found`)
  return node
}

describe('graph projection', () => {
  it('projects the catalog into nodes and edges', async () => {
    expect(report.games).toHaveLength(1)
    const game = report.games[0]
    expect(game?.slug).toBe('pokemon')
    expect(game?.skippedEdges).toBe(0)

    const stats = await getGraphStats(database.db, 'pokemon')
    expect(stats.byNodeType.game).toBe(1)
    expect(stats.byNodeType.series).toBe(1)
    expect(stats.byNodeType.set).toBe(1)
    expect(stats.byNodeType.card_printing).toBe(102)
    expect(stats.byNodeType.card_identity).toBeGreaterThan(90)
    expect(stats.byNodeType.artist).toBe(4)
    expect(stats.byNodeType.pokemon).toBeGreaterThan(50)
    expect(stats.byNodeType.attribute).toBeGreaterThan(5)
    expect(stats.byNodeType.mechanic).toBeGreaterThan(50)
    expect(stats.nodes).toBe(game?.nodes)
    expect(stats.edges).toBe(game?.edges)
  })

  it('has no dangling edges', async () => {
    const nodes = new Set((await database.db.select().from(graphNodes)).map((n) => n.id))
    const edges = await database.db.select().from(graphEdges)
    expect(edges.every((e) => nodes.has(e.sourceNodeId) && nodes.has(e.targetNodeId))).toBe(true)
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length)
  })

  it('is deterministic and idempotent on rebuild', async () => {
    const before = await database.db.select().from(graphNodes)
    const again = await buildGraphProjection({ database, registry })
    expect(again.games[0]?.nodes).toBe(report.games[0]?.nodes)
    expect(again.games[0]?.edges).toBe(report.games[0]?.edges)
    const after = await database.db.select().from(graphNodes)
    expect(after.map((n) => n.id).sort()).toEqual(before.map((n) => n.id).sort())
  })

  it('gives card nodes image, set, number and rarity', async () => {
    const charizard = (await database.db.select().from(graphNodes)).find(
      (n) => n.nodeType === 'card_printing' && n.label === 'Charizard',
    )
    expect(charizard?.imageUrl).toContain('/high.webp')
    expect(charizard?.subtitle).toBe('Base Set · 4/102')
    expect(charizard?.metadata.rarity).toBe('Rare')
    expect(charizard?.metadata.collectorNumber).toBe('4')
    expect(charizard?.searchText).toContain('charizard')
    expect(charizard?.searchText).toContain('base set')
  })
})

describe('neighborhood', () => {
  it('returns the direct relationships of a card printing', async () => {
    const charizard = await findNode('card_printing', 'Charizard')
    const hood = await getNeighborhood(database.db, charizard.id, { depth: 1 })
    expect(hood.focus.id).toBe(charizard.id)
    expect(hood.meta.depth).toBe(1)
    expect(hood.meta.truncated).toBe(false)
    const labels = new Map(hood.nodes.map((n) => [`${n.nodeType}:${n.label}`, n]))
    expect(labels.has('set:Base Set')).toBe(true)
    expect(labels.has('card_identity:Charizard')).toBe(true)
    expect(labels.has('card_identity:Charmeleon')).toBe(true)
    expect(labels.has('artist:Mitsuhiro Arita')).toBe(true)
    expect(labels.has('pokemon:Charizard')).toBe(true)
    expect(labels.has('attribute:Fire')).toBe(true)
    expect(labels.has('mechanic:Fire Spin')).toBe(true)
    const types = new Set(hood.edges.map((e) => e.relationshipType))
    expect(types).toContain('BELONGS_TO')
    expect(types).toContain('PRINTING_OF')
    expect(types).toContain('ILLUSTRATED_BY')
    expect(types).toContain('EVOLVES_FROM')
    expect(hood.meta.distances[charizard.id]).toBe(0)
    expect(Object.values(hood.meta.distances).every((d) => d <= 1)).toBe(true)
  })

  it('expands progressively with bounded depth and size', async () => {
    const charizard = await findNode('card_printing', 'Charizard')
    const d1 = await getNeighborhood(database.db, charizard.id, { depth: 1 })
    const d2 = await getNeighborhood(database.db, charizard.id, { depth: 2, limit: 80 })
    expect(d2.nodes.length).toBeGreaterThan(d1.nodes.length)
    expect(d2.nodes.length).toBeLessThanOrEqual(80)
    expect(d2.meta.truncated).toBe(true)
    const d0 = await getNeighborhood(database.db, charizard.id, { depth: 0 })
    expect(d0.nodes).toHaveLength(1)
    expect(d0.edges).toHaveLength(0)
    const tooDeep = await getNeighborhood(database.db, charizard.id, { depth: 99, limit: 20 })
    expect(tooDeep.meta.depth).toBe(3)
  })

  it('respects relationship and node type filters', async () => {
    const charizard = await findNode('card_printing', 'Charizard')
    const onlySet = await getNeighborhood(database.db, charizard.id, {
      depth: 1,
      relationshipTypes: ['BELONGS_TO'],
    })
    expect(onlySet.nodes.map((n) => n.nodeType).sort()).toEqual(['card_printing', 'set'])

    const noAttributes = await getNeighborhood(database.db, charizard.id, {
      depth: 1,
      excludeNodeTypes: ['attribute', 'mechanic'],
    })
    expect(noAttributes.nodes.some((n) => n.nodeType === 'attribute')).toBe(false)
    expect(noAttributes.nodes.some((n) => n.nodeType === 'set')).toBe(true)
  })

  it('caps the fan-out of hub nodes', async () => {
    const set = await findNode('set', 'Base Set')
    const hood = await getNeighborhood(database.db, set.id, { depth: 1, perNodeLimit: 10 })
    // focus + at most 10 neighbors (the series plus printings, best weight first)
    expect(hood.nodes.length).toBeLessThanOrEqual(11)
    const full = await getNeighborhood(database.db, set.id, { depth: 1, perNodeLimit: 500 })
    expect(full.nodes.filter((n) => n.nodeType === 'card_printing')).toHaveLength(102)
  })

  it('throws a typed error for unknown nodes', async () => {
    await expect(getNeighborhood(database.db, 'card_printing:nope')).rejects.toBeInstanceOf(GraphError)
  })

  it('summarises relationships per type and direction', async () => {
    const identity = await findNode('card_identity', 'Charizard')
    const summary = await getRelationshipSummary(database.db, identity.id)
    expect(summary.find((s) => s.relationshipType === 'PRINTING_OF' && s.direction === 'in')?.count).toBe(1)
    expect(summary.find((s) => s.relationshipType === 'EVOLUTION_OF' && s.direction === 'out')?.count).toBe(1)
  })
})

describe('universe', () => {
  it('shows game, series and sets only', async () => {
    const universe = await getUniverse(database.db, 'pokemon')
    expect(universe).not.toBeNull()
    expect(universe?.focus.nodeType).toBe('game')
    expect(universe?.nodes.map((n) => n.nodeType).sort()).toEqual(['game', 'series', 'set'])
    expect(universe?.edges.map((e) => e.relationshipType)).toEqual(['PART_OF', 'PART_OF'])
    expect(await getUniverse(database.db, 'unknown')).toBeNull()
  })
})
