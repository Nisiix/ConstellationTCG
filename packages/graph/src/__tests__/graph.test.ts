import { cardPrintings, eq, graphEdges, graphNodes, tcgSets, type Database } from '@constellation/database'
import { GraphError } from '@constellation/domain'
import { createSeededDatabase, ingestFixture } from '@constellation/testing'
import type { AdapterRegistry } from '@constellation/adapters'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildGraphProjection, type BuildReport } from '../builder'
import { getNeighborhood } from '../neighborhood'
import { getConnections, getGraphStats, getRelationshipSummary } from '../node'
import { getUniverse, UNIVERSE_BRIDGES_PER_SET } from '../universe'

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
    // Energy types, weaknesses, abilities and attacks are card data, not points.
    expect(stats.byNodeType.attribute ?? 0).toBe(0)
    expect(stats.byNodeType.mechanic ?? 0).toBe(0)
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

  it('gives artists and Pokémon a representative card image', async () => {
    const all = await database.db.select().from(graphNodes)
    const arita = all.find((n) => n.nodeType === 'artist' && n.label === 'Mitsuhiro Arita')
    expect(arita?.imageUrl).toMatch(/\/high\.webp$/)
    const charizard = all.find((n) => n.nodeType === 'pokemon' && n.label === 'Charizard')
    expect(charizard?.imageUrl).toContain('/base1/4/')
    expect(all.some((n) => n.nodeType === 'attribute')).toBe(false)
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
    // It evolves from the Charmeleon printed in the same set.
    expect(labels.has('card_printing:Charmeleon')).toBe(true)
    expect(labels.has('artist:Mitsuhiro Arita')).toBe(true)
    expect(labels.has('pokemon:Charizard')).toBe(true)
    // Not because both are Fire.
    expect(hood.nodes.some((n) => n.nodeType === 'attribute')).toBe(false)
    expect(labels.has('mechanic:Energy Burn')).toBe(false)
    expect(labels.has('mechanic:Fire Spin')).toBe(false)
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
    const d2 = await getNeighborhood(database.db, charizard.id, { depth: 2, limit: 12 })
    expect(d2.nodes.length).toBeGreaterThan(d1.nodes.length)
    expect(d2.nodes.length).toBeLessThanOrEqual(12)
    expect(d2.meta.truncated).toBe(true)
    const d0 = await getNeighborhood(database.db, charizard.id, { depth: 0 })
    expect(d0.nodes).toHaveLength(1)
    expect(d0.edges).toHaveLength(0)
    const tooDeep = await getNeighborhood(database.db, charizard.id, { depth: 99, limit: 20 })
    expect(tooDeep.meta.depth).toBe(2)
  })

  it('respects relationship and node type filters', async () => {
    const charizard = await findNode('card_printing', 'Charizard')
    const onlySet = await getNeighborhood(database.db, charizard.id, {
      depth: 1,
      relationshipTypes: ['BELONGS_TO'],
    })
    expect(onlySet.nodes.map((n) => n.nodeType).sort()).toEqual(['card_printing', 'set'])

    const noSpecies = await getNeighborhood(database.db, charizard.id, {
      depth: 1,
      excludeNodeTypes: ['pokemon'],
    })
    expect(noSpecies.nodes.some((n) => n.nodeType === 'pokemon')).toBe(false)
    expect(noSpecies.nodes.some((n) => n.nodeType === 'set')).toBe(true)
  })

  it('caps the fan-out of hub nodes', async () => {
    const set = await findNode('set', 'Base Set')
    const hood = await getNeighborhood(database.db, set.id, { depth: 1, perNodeLimit: 10 })
    // The budget is per kind of relationship: at most 10 printings, plus the series (its own kind).
    expect(hood.nodes.filter((n) => n.nodeType === 'card_printing').length).toBeLessThanOrEqual(10)
    expect(hood.nodes.some((n) => n.nodeType === 'series')).toBe(true)
    expect(hood.nodes.length).toBeLessThanOrEqual(12)
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

describe('placeholder images', () => {
  let db: Database
  let reg: AdapterRegistry
  let placeholder: string

  beforeAll(async () => {
    const seeded = await createSeededDatabase()
    db = seeded.database
    reg = seeded.registry
    placeholder = reg.bySlug('pokemon')?.definition().placeholderImages?.set ?? ''
    // A set the source knows but has no artwork for (like "W Promotional" in the Base series).
    const [base] = await db.db.select().from(tcgSets).where(eq(tcgSets.externalId, 'base1'))
    if (!base) throw new Error('fixture set missing')
    await db.db.insert(tcgSets).values({
      gameId: base.gameId,
      seriesId: base.seriesId,
      sourceId: base.sourceId,
      externalId: 'wp',
      slug: 'w-promotional',
      name: 'W Promotional',
      releaseDate: '1999-07-01',
      symbolUrl: null,
      logoUrl: null,
      cardCountTotal: 7,
      cardCountOfficial: 7,
      rawHash: 'test',
    })
    await buildGraphProjection({ database: db, registry: reg })
  })

  afterAll(async () => {
    await db.close()
  })

  it('shows the standard Pokémon logo for a set without an image of its own', async () => {
    expect(placeholder).toMatch(/logo\.webp$/)
    const all = await db.db.select().from(graphNodes)
    const promo = all.find((n) => n.nodeType === 'set' && n.label === 'W Promotional')
    expect(promo?.imageUrl).toBe(placeholder)
    expect(promo?.metadata.imagePlaceholder).toBe(true)
  })

  it('keeps a set\'s own logo when it has one', async () => {
    const all = await db.db.select().from(graphNodes)
    const base = all.find((n) => n.nodeType === 'set' && n.label === 'Base Set')
    expect(base?.imageUrl).toBe('https://assets.tcgdex.net/en/base/base1/logo.webp')
    expect(base?.metadata.imagePlaceholder).toBe(false)
    const series = all.find((n) => n.nodeType === 'series')
    expect(series?.metadata.imagePlaceholder).toBe(false)
  })

  it('lists sets in the universe from the most recent to the oldest', async () => {
    const universe = await getUniverse(db.db, 'pokemon')
    const sets = universe?.nodes.filter((n) => n.nodeType === 'set').map((n) => n.label)
    expect(sets).toEqual(['W Promotional', 'Base Set'])
  })

  it('gives the game node the standard logo, flagged as a placeholder', async () => {
    const all = await db.db.select().from(graphNodes)
    const game = all.find((n) => n.nodeType === 'game')
    expect(game?.imageUrl).toBe(placeholder)
    expect(game?.metadata.imagePlaceholder).toBe(true)
  })
})

describe('reprints across sets', () => {
  it('links a later printing of the same card to its first printing, and the original is a hub', async () => {
    const charizard = await findNode('card_printing', 'Charizard')
    const [base] = await database.db.select().from(tcgSets).limit(1)
    const [printing] = await database.db.select().from(cardPrintings).where(eq(cardPrintings.id, charizard.entityId))
    if (!base || !printing) throw new Error('fixture rows missing')
    // Base Set 2 reprinted Charizard: a second printing of the same identity in a later set.
    const [later] = await database.db
      .insert(tcgSets)
      .values({
        gameId: base.gameId,
        seriesId: base.seriesId,
        sourceId: base.sourceId,
        externalId: 'base4',
        slug: 'base-set-2',
        name: 'Base Set 2',
        releaseDate: '2000-02-24',
        rawHash: 'test-base4',
      })
      .returning()
    if (!later) throw new Error('set not created')
    await database.db.insert(cardPrintings).values({
      identityId: printing.identityId,
      setId: later.id,
      sourceId: printing.sourceId,
      externalId: 'base4-4',
      collectorNumber: '4',
      printedNumber: '4/130',
      rarity: printing.rarity,
      artistId: printing.artistId,
      imageFront: printing.imageFront,
      attributes: printing.attributes,
      rawDataHash: 'test-base4-4',
    })

    const rebuilt = await buildGraphProjection({ database, registry })
    expect(rebuilt.games[0]?.skippedEdges).toBe(0)
    const edges = await database.db.select().from(graphEdges)
    const reprints = edges.filter((e) => e.relationshipType === 'REPRINT_OF')
    expect(reprints).toHaveLength(1)
    expect(reprints[0]?.targetNodeId).toBe(charizard.id)
    expect(reprints[0]?.sourceNodeId).not.toBe(charizard.id)
    expect(reprints[0]?.weight).toBeCloseTo(0.7)

    // One hop from the original reaches its reprint; the summary names the relationship.
    const hood = await getNeighborhood(database.db, charizard.id, { depth: 1 })
    expect(hood.nodes.some((n) => n.id === reprints[0]?.sourceNodeId)).toBe(true)
    const summary = await getRelationshipSummary(database.db, charizard.id)
    expect(summary.some((s) => s.relationshipType === 'REPRINT_OF' && s.direction === 'in')).toBe(true)
  })
})

describe('relationship summary filters', () => {
  it('counts only the connections the neighborhood would show', async () => {
    const charizard = await findNode('card_printing', 'Charizard')
    const all = await getRelationshipSummary(database.db, charizard.id)
    expect(all.some((s) => s.relationshipType === 'SAME_POKEMON')).toBe(true)
    const cardsAndSets = await getRelationshipSummary(database.db, charizard.id, {
      nodeTypes: ['set', 'card_identity', 'card_printing', 'artist'],
    })
    expect(cardsAndSets.some((s) => s.relationshipType === 'SAME_POKEMON')).toBe(false)
    expect(cardsAndSets.some((s) => s.relationshipType === 'HAS_TYPE')).toBe(false)
    expect(cardsAndSets.some((s) => s.relationshipType === 'BELONGS_TO')).toBe(true)
    expect(cardsAndSets.some((s) => s.relationshipType === 'ILLUSTRATED_BY')).toBe(true)
    const onlyArtist = await getRelationshipSummary(database.db, charizard.id, { relationshipTypes: ['ILLUSTRATED_BY'] })
    expect(onlyArtist.map((s) => s.relationshipType)).toEqual(['ILLUSTRATED_BY'])
  })
})

describe('per-node budget', () => {
  it('spends it per kind of relationship, in collector-number order, so a set keeps its series and its first cards', async () => {
    const baseSet = await findNode('set', 'Base Set')
    const hood = await getNeighborhood(database.db, baseSet.id, { depth: 1, perNodeLimit: 10 })
    const types = new Set(hood.nodes.map((n) => n.nodeType))
    expect(types.has('series')).toBe(true)
    const cards = hood.nodes.filter((n) => n.nodeType === 'card_printing')
    expect(cards).toHaveLength(10)
    const numbers = cards.map((n) => Number(n.metadata.collectorNumber)).sort((a, b) => a - b)
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(cards.some((n) => n.label === 'Charizard')).toBe(true)
  })
})

// The `base2` fixture is Jungle (TCGdex numbers Base Set 2 `base4`): three artists and two
// Pokémon (Electrode, Pikachu) in common with Base Set.
describe('connections across expansions (Base Set and Jungle)', () => {
  let two: Database
  let reg: AdapterRegistry

  beforeAll(async () => {
    const seeded = await createSeededDatabase('base1')
    two = seeded.database
    reg = seeded.registry
    await ingestFixture(two, 'base2')
    await buildGraphProjection({ database: two, registry: reg })
  })

  afterAll(async () => {
    await two.close()
  })

  async function nodeOf(nodeType: string, label: string) {
    const node = (await two.db.select().from(graphNodes)).find((n) => n.nodeType === nodeType && n.label === label)
    if (!node) throw new Error(`node ${nodeType} "${label}" not found`)
    return node
  }

  it('relates the two sets by their artists and their make-up, newer to older', async () => {
    const base = await nodeOf('set', 'Base Set')
    const jungle = await nodeOf('set', 'Jungle')
    const edges = (await two.db.select().from(graphEdges)).filter((e) => e.sourceNodeId === jungle.id && e.targetNodeId === base.id)
    const types = edges.map((e) => e.relationshipType).sort()
    // Two Pokémon out of a hundred are not "the same Pokémon": no SHARED_SUBJECTS between them.
    expect(types).toEqual(['SHARED_ARTISTS', 'SIMILAR_STRUCTURE'])
    expect(edges.every((e) => e.direction === 'undirected')).toBe(true)
    expect(edges.find((e) => e.relationshipType === 'SHARED_ARTISTS')?.metadata.shared).toBe(3)

    // A set in focus shows its kindred sets directly.
    const hood = await getNeighborhood(two.db, base.id, { depth: 1 })
    expect(hood.nodes.some((n) => n.id === jungle.id)).toBe(true)

    // Undirected: one group, whichever end is in focus.
    for (const set of [base, jungle]) {
      const summary = await getRelationshipSummary(two.db, set.id, { relationshipTypes: ['SHARED_ARTISTS'] })
      expect(summary).toEqual([{ relationshipType: 'SHARED_ARTISTS', direction: 'out', count: 1 }])
      const listed = await getConnections(two.db, set.id, { relationshipType: 'SHARED_ARTISTS', direction: 'out' })
      expect(listed.items.map((i) => i.node.id)).toEqual([set === base ? jungle.id : base.id])
    }
  })

  it('shows the universe as one sky: sets joined by their strongest bridges, never the cards', async () => {
    const universe = await getUniverse(two.db, 'pokemon')
    if (!universe) throw new Error('universe')
    const base = await nodeOf('set', 'Base Set')
    const jungle = await nodeOf('set', 'Jungle')
    const bridges = universe.edges.filter((e) => e.sourceNodeId.startsWith('set:') && e.targetNodeId.startsWith('set:'))
    expect(bridges.map((e) => e.relationshipType).sort()).toEqual(['SHARED_ARTISTS', 'SIMILAR_STRUCTURE'])
    expect(bridges.every((e) => e.sourceNodeId === jungle.id && e.targetNodeId === base.id)).toBe(true)
    // Still only the game, its series and its sets.
    expect(new Set(universe.nodes.map((n) => n.nodeType))).toEqual(new Set(['game', 'series', 'set']))
    expect(universe.edges.filter((e) => e.relationshipType === 'PART_OF')).toHaveLength(3)
    // At most UNIVERSE_BRIDGES_PER_SET bridges touch a set.
    const touching = (id: string) => bridges.filter((e) => e.sourceNodeId === id || e.targetNodeId === id).length
    expect(touching(base.id)).toBeLessThanOrEqual(UNIVERSE_BRIDGES_PER_SET)
  })

  it('never pairs a card with a reprint of itself as a counterpart', async () => {
    const printings = new Map((await two.db.select().from(cardPrintings)).map((p) => [`card_printing:${p.id}`, p]))
    const counterparts = (await two.db.select().from(graphEdges)).filter((e) => e.relationshipType === 'COUNTERPART_OF')
    for (const e of counterparts) {
      expect(printings.get(e.sourceNodeId)?.identityId).not.toBe(printings.get(e.targetNodeId)?.identityId)
    }
  })

  it('reaches other cards through the card, the Pokémon or the artist, never through the set', async () => {
    const [charizard] = (await two.db.select().from(graphNodes)).filter(
      (n) => n.nodeType === 'card_printing' && n.label === 'Charizard' && n.subtitle?.startsWith('Base Set ·'),
    )
    if (!charizard) throw new Error('fixture')
    const hood = await getNeighborhood(two.db, charizard.id, { depth: 2, limit: 1000, perNodeLimit: 500 })
    const d = hood.meta.distances
    const containers = new Set(['game', 'series', 'set'])
    const typeOf = new Map(hood.nodes.map((n) => [n.id, n.nodeType]))
    const far = hood.nodes.filter((n) => d[n.id] === 2 && n.nodeType === 'card_printing')
    expect(far.length).toBeGreaterThan(5)
    for (const node of far) {
      // Every far card hangs from a direct connection that is not a set, a series or the game.
      const bridges = hood.edges
        .filter((e) => e.sourceNodeId === node.id || e.targetNodeId === node.id)
        .map((e) => (e.sourceNodeId === node.id ? e.targetNodeId : e.sourceNodeId))
        .filter((id) => d[id] === 1 && !containers.has(typeOf.get(id) ?? ''))
      expect(bridges.length, node.label).toBeGreaterThan(0)
    }
    // Mitsuhiro Arita's Jungle illustrations are two steps away, through the artist.
    expect(far.some((n) => n.subtitle?.startsWith('Jungle'))).toBe(true)
    // Base Set cards that share nothing with Charizard but the set are not there.
    expect(far.some((n) => n.label === 'Alakazam')).toBe(false)
  })
})

describe('connection lists', () => {
  it('lists every connection of one kind, a page at a time, in the order the panel uses', async () => {
    const set = await findNode('set', 'Base Set')
    const first = await getConnections(database.db, set.id, { relationshipType: 'BELONGS_TO', direction: 'in', limit: 40 })
    expect(first.total).toBe(102)
    expect(first.items).toHaveLength(40)
    // A set's cards come in collector-number order, as in the set list.
    expect(first.items.slice(0, 4).map((i) => i.node.metadata.collectorNumber)).toEqual(['1', '2', '3', '4'])
    const last = await getConnections(database.db, set.id, { relationshipType: 'BELONGS_TO', direction: 'in', offset: 80, limit: 40 })
    expect(last.items).toHaveLength(22)
    expect(last.items.at(-1)?.node.metadata.collectorNumber).toBe('102')
    // Only the node types asked for.
    const none = await getConnections(database.db, set.id, { relationshipType: 'BELONGS_TO', direction: 'in', nodeTypes: ['artist'] })
    expect(none.total).toBe(0)
  })

  it('keeps only the printings a filter allows', async () => {
    const set = await findNode('set', 'Base Set')
    const all = await getConnections(database.db, set.id, { relationshipType: 'BELONGS_TO', direction: 'in', limit: 500 })
    const allowed = new Set(all.items.slice(0, 3).map((i) => i.node.id))
    const filtered = await getConnections(database.db, set.id, { relationshipType: 'BELONGS_TO', direction: 'in', allowedPrintingNodeIds: allowed })
    expect(filtered.total).toBe(3)
  })
})
