import { graphNodes, sql, type Database } from '@constellation/database'
import { GraphError } from '@constellation/domain'
import { createSeededDatabase } from '@constellation/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildGraphProjection } from '../builder'
import { PATH_BRIDGE_NODE_TYPES, PathIndex, getPath, type PathCache } from '../path'

function memoryCache(): PathCache {
  const map = new Map<string, Parameters<PathCache['set']>[1]>()
  return { get: (id) => map.get(id), set: (id, entry) => void map.set(id, entry) }
}

describe('PathIndex (synthetic graph)', () => {
  const nodes = [
    { id: 'game:g', nodeType: 'game' },
    { id: 'series:s', nodeType: 'series' },
    { id: 'set:a', nodeType: 'set' },
    { id: 'set:b', nodeType: 'set' },
    { id: 'card_printing:1', nodeType: 'card_printing' },
    { id: 'card_printing:2', nodeType: 'card_printing' },
    { id: 'card_printing:3', nodeType: 'card_printing' },
    { id: 'artist:x', nodeType: 'artist' },
    { id: 'attribute:fire', nodeType: 'attribute' },
    { id: 'pokemon:p', nodeType: 'pokemon' },
  ]
  const edges = [
    { id: 'e1', source: 'series:s', target: 'game:g', relationshipType: 'PART_OF' },
    { id: 'e2', source: 'set:a', target: 'series:s', relationshipType: 'PART_OF' },
    { id: 'e3', source: 'set:b', target: 'series:s', relationshipType: 'PART_OF' },
    { id: 'e4', source: 'card_printing:1', target: 'set:a', relationshipType: 'BELONGS_TO' },
    { id: 'e5', source: 'card_printing:2', target: 'set:b', relationshipType: 'BELONGS_TO' },
    { id: 'e6', source: 'card_printing:3', target: 'set:b', relationshipType: 'BELONGS_TO' },
    // Two routes of length 2 from 1 to 2: through the artist and through a reprint hub (3).
    { id: 'e7', source: 'card_printing:1', target: 'artist:x', relationshipType: 'ILLUSTRATED_BY' },
    { id: 'e8', source: 'card_printing:2', target: 'artist:x', relationshipType: 'ILLUSTRATED_BY' },
    { id: 'e9', source: 'card_printing:1', target: 'card_printing:3', relationshipType: 'REPRINT_OF' },
    { id: 'e10', source: 'card_printing:2', target: 'card_printing:3', relationshipType: 'REPRINT_OF' },
    // Shortcuts that must not be taken: an energy type and a species joining everything.
    { id: 'e11', source: 'card_printing:1', target: 'attribute:fire', relationshipType: 'HAS_TYPE' },
    { id: 'e12', source: 'card_printing:2', target: 'attribute:fire', relationshipType: 'HAS_TYPE' },
    { id: 'e13', source: 'card_printing:1', target: 'pokemon:p', relationshipType: 'SAME_POKEMON' },
  ]
  const index = new PathIndex(nodes, edges)

  it('prefers a reprint over an artist among equally short paths', () => {
    const result = index.find('card_printing:1', 'card_printing:2')
    expect(result.found).toBe(true)
    expect(result.nodeIds).toEqual(['card_printing:1', 'card_printing:3', 'card_printing:2'])
    expect(result.relationships).toEqual(['REPRINT_OF', 'REPRINT_OF'])
    expect(result.edgeIds).toEqual(['e9', 'e10'])
  })

  it('never crosses the game, an energy type or a species', () => {
    const result = index.find('set:a', 'set:b')
    expect(result.found).toBe(true)
    expect(result.nodeIds).toEqual(['set:a', 'series:s', 'set:b'])
    const viaAttribute = new PathIndex(nodes, edges.filter((e) => e.id !== 'e9' && e.id !== 'e10' && e.id !== 'e7' && e.id !== 'e8'))
    const result2 = viaAttribute.find('card_printing:1', 'card_printing:2')
    expect(result2.nodeIds).not.toContain('attribute:fire')
    expect(result2.nodeIds).toEqual(['card_printing:1', 'set:a', 'series:s', 'set:b', 'card_printing:2'])
  })

  it('lets any kind of point be an end', () => {
    expect(index.find('game:g', 'card_printing:1').nodeIds).toEqual(['game:g', 'series:s', 'set:a', 'card_printing:1'])
    expect(index.find('pokemon:p', 'artist:x').nodeIds).toEqual(['pokemon:p', 'card_printing:1', 'artist:x'])
    expect(index.find('attribute:fire', 'card_printing:2').nodeIds).toEqual(['attribute:fire', 'card_printing:2'])
  })

  it('stops at the depth asked for', () => {
    const result = index.find('game:g', 'card_printing:1', { maxDepth: 2 })
    expect(result.found).toBe(false)
    expect(index.find('game:g', 'card_printing:1', { maxDepth: 3 }).found).toBe(true)
  })

  it('answers the same path every time and the same length both ways', () => {
    const a = index.find('card_printing:1', 'card_printing:2')
    const b = index.find('card_printing:1', 'card_printing:2')
    expect(b).toEqual(a)
    expect(index.find('card_printing:2', 'card_printing:1').nodeIds).toHaveLength(a.nodeIds.length)
  })

  it('finds a point from itself and nothing for unknown points', () => {
    expect(index.find('set:a', 'set:a')).toMatchObject({ found: true, nodeIds: ['set:a'], edgeIds: [] })
    expect(index.find('set:a', 'set:zzz').found).toBe(false)
  })
})

describe('getPath (Base Set fixture)', () => {
  let database: Database
  let ids: Record<string, string>

  beforeAll(async () => {
    const seeded = await createSeededDatabase()
    database = seeded.database
    await buildGraphProjection({ database, registry: seeded.registry })
    const all = await database.db.select().from(graphNodes)
    const pick = (type: string, label: string) => {
      const node = all.find((n) => n.nodeType === type && n.label === label)
      if (!node) throw new Error(`${type} ${label} not found`)
      return node.id
    }
    ids = {
      charizard: pick('card_printing', 'Charizard'),
      pikachu: pick('card_printing', 'Pikachu'),
      game: all.find((n) => n.nodeType === 'game')!.id,
      pikachuSpecies: pick('pokemon', 'Pikachu'),
    }
  }, 60_000)

  afterAll(async () => {
    await database.close()
  })

  it('joins two cards with ordered points and connections between them', async () => {
    const path = await getPath(database.db, ids.charizard!, ids.pikachu!, { cache: memoryCache() })
    expect(path.found).toBe(true)
    expect(path.nodes[0]?.id).toBe(ids.charizard)
    expect(path.nodes.at(-1)?.id).toBe(ids.pikachu)
    expect(path.edges).toHaveLength(path.nodes.length - 1)
    path.edges.forEach((edge, i) => {
      const ends = [edge.sourceNodeId, edge.targetNodeId].sort()
      expect(ends).toEqual([path.nodes[i]!.id, path.nodes[i + 1]!.id].sort())
    })
    for (const node of path.nodes.slice(1, -1)) expect(PATH_BRIDGE_NODE_TYPES).toContain(node.nodeType)
    // Both are illustrated by Mitsuhiro Arita: the artist is the shortest bridge.
    expect(path.nodes.map((n) => n.label)).toEqual(['Charizard', 'Mitsuhiro Arita', 'Pikachu'])
    expect(path.edges.map((e) => e.relationshipType)).toEqual(['ILLUSTRATED_BY', 'ILLUSTRATED_BY'])
  })

  it('goes from the game to a species without passing through either as a bridge', async () => {
    const path = await getPath(database.db, ids.game!, ids.pikachuSpecies!, { cache: memoryCache() })
    expect(path.found).toBe(true)
    expect(path.nodes.map((n) => n.nodeType)).toEqual(['game', 'series', 'set', 'card_printing', 'pokemon'])
  })

  it('says when the ends are too far apart for the depth asked', async () => {
    const path = await getPath(database.db, ids.game!, ids.pikachuSpecies!, { maxDepth: 2, cache: memoryCache() })
    expect(path).toMatchObject({ found: false, reason: 'too-far', maxDepth: 2, nodes: [], edges: [] })
  })

  it('rejects unknown and malformed points', async () => {
    await expect(getPath(database.db, ids.charizard!, 'card_printing:00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(GraphError)
    await expect(getPath(database.db, 'nonsense', ids.pikachu!)).rejects.toMatchObject({ details: { status: 400 } })
  })

  it('rebuilds a stale index after the projection changed (regression: no vanished points)', async () => {
    const cache = memoryCache()
    const before = await getPath(database.db, ids.charizard!, ids.pikachu!, { cache, recheckMs: 0 })
    const artist = before.nodes[1]!
    expect(artist.nodeType).toBe('artist')
    await database.db.execute(sql`delete from graph_nodes where id = ${artist.id}`)
    const after = await getPath(database.db, ids.charizard!, ids.pikachu!, { cache, recheckMs: 0 })
    expect(after.found).toBe(true)
    expect(after.nodes.map((n) => n.id)).not.toContain(artist.id)
    // Without the artist, the next bridge is the set they share.
    expect(after.nodes.map((n) => n.nodeType)).toEqual(['card_printing', 'set', 'card_printing'])
  })
})
