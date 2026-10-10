import { graphNodes, type Database } from '@constellation/database'
import { GraphError } from '@constellation/domain'
import { createSeededDatabase, ingestFixture } from '@constellation/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildGraphProjection } from '../builder'
import { getLandmarks } from '../landmarks'
import { getLineage, stagesOf, yearOf } from '../lineage'

let db: Database

beforeAll(async () => {
  const seeded = await createSeededDatabase('base1')
  db = seeded.database
  await ingestFixture(db, 'base2')
  await buildGraphProjection({ database: db, registry: seeded.registry })
})

afterAll(async () => {
  await db.close()
})

async function nodeOf(nodeType: string, label: string) {
  const node = (await db.db.select().from(graphNodes)).find((n) => n.nodeType === nodeType && n.label === label)
  if (!node) throw new Error(`node ${nodeType} "${label}" not found`)
  return node
}

describe('lineage', () => {
  it('follows a Pokémon through its evolution line, its printings, eras and artists', async () => {
    const charmeleon = await nodeOf('pokemon', 'Charmeleon')
    const lineage = await getLineage(db.db, charmeleon.id, { subjectRelation: 'SAME_POKEMON' })
    expect(lineage.subject.id).toBe(charmeleon.id)
    expect(lineage.family.map((m) => [m.node.label, m.stage])).toEqual([
      ['Charmander', 0],
      ['Charmeleon', 1],
      ['Charizard', 2],
    ])
    expect(lineage.family.find((m) => m.node.label === 'Charizard')?.evolvesFrom).toEqual([charmeleon.id])
    expect(lineage.printings.length).toBeGreaterThan(0)
    expect(lineage.printings.every((p) => p.nodeType === 'card_printing')).toBe(true)
    expect(lineage.eras[0]?.sets[0]?.set.label).toBe('Base Set')
    expect(lineage.eras[0]?.series?.nodeType).toBe('series')
    expect(lineage.artists.length).toBeGreaterThan(0)
    expect(lineage.first?.id).toBe(lineage.printings[0]?.id)
    // The family's evolution edges and the debut join the real edges.
    expect(lineage.edges.some((e) => e.relationshipType === 'EVOLUTION_OF' && e.sourceNodeId === charmeleon.id)).toBe(true)
    expect(lineage.edges.some((e) => e.relationshipType === 'SAME_POKEMON' && e.targetNodeId === charmeleon.id)).toBe(true)
    expect(lineage.edges.some((e) => e.relationshipType === 'BELONGS_TO')).toBe(true)
    const ids = new Set([lineage.subject.id, ...lineage.printings.map((p) => p.id), ...lineage.family.map((m) => m.node.id)])
    for (const era of lineage.eras) {
      if (era.series) ids.add(era.series.id)
      for (const s of era.sets) ids.add(s.set.id)
    }
    for (const a of lineage.artists) ids.add(a.node.id)
    expect(lineage.edges.every((e) => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId))).toBe(true)
  })

  it('spans expansions newest first when a Pokémon returns', async () => {
    const pikachu = await nodeOf('pokemon', 'Pikachu')
    const lineage = await getLineage(db.db, pikachu.id, { subjectRelation: 'SAME_POKEMON' })
    const sets = lineage.eras.flatMap((e) => e.sets.map((s) => s.set.label))
    expect(sets).toEqual(['Jungle', 'Base Set'])
    expect(lineage.setCount).toBe(2)
    expect(lineage.first?.metadata.setName).toBe('Base Set')
    expect(lineage.latest?.metadata.setName).toBe('Jungle')
  })

  it('opens from a card: its Pokémon, or the card itself when it shows none', async () => {
    const charizard = await nodeOf('card_printing', 'Charizard')
    const fromCard = await getLineage(db.db, charizard.id, { subjectRelation: 'SAME_POKEMON' })
    expect(fromCard.from.id).toBe(charizard.id)
    expect(fromCard.subject.nodeType).toBe('pokemon')
    expect(fromCard.subject.label).toBe('Charizard')

    const trainer = (await db.db.select().from(graphNodes)).find(
      (n) => n.nodeType === 'card_printing' && String((n.metadata as Record<string, unknown>).category).toLowerCase() === 'trainer',
    )
    expect(trainer).toBeDefined()
    const ofTrainer = await getLineage(db.db, trainer!.id, { subjectRelation: 'SAME_POKEMON' })
    expect(ofTrainer.subject.nodeType).toBe('card_identity')
    expect(ofTrainer.printings.some((p) => p.id === trainer!.id)).toBe(true)
    expect(ofTrainer.family).toEqual([])
  })

  it('refuses points that have no lineage', async () => {
    const base = await nodeOf('set', 'Base Set')
    await expect(getLineage(db.db, base.id, { subjectRelation: 'SAME_POKEMON' })).rejects.toBeInstanceOf(GraphError)
    await expect(getLineage(db.db, 'pokemon:missing', {})).rejects.toBeInstanceOf(GraphError)
  })

  it('reads stages from the longest line and years from dates', () => {
    const from = new Map([
      ['b', new Set(['a'])],
      ['c', new Set(['b'])],
      ['x', new Set(['a'])],
    ])
    expect(Object.fromEntries(stagesOf(['a', 'b', 'c', 'x'], from))).toEqual({ a: 0, b: 1, c: 2, x: 1 })
    expect(yearOf('1999-01-09')).toBe(1999)
    expect(yearOf(null)).toBeNull()
    expect(yearOf('n/a')).toBeNull()
  })
})

describe('landmarks', () => {
  it('names the landmarks of the sky, each with its reason', async () => {
    const landmarks = await getLandmarks(db.db, 'pokemon')
    expect(landmarks?.game.nodeType).toBe('game')
    const byId = new Map(landmarks!.categories.map((c) => [c.id, c]))
    expect(byId.get('eras')?.items.map((i) => i.node.label)).toEqual(['Base Set'])
    expect(byId.get('eras')?.items[0]?.reason).toMatch(/^Opened .+ in 1999$/)
    expect(byId.get('crossroads')?.items.map((i) => i.node.label).sort()).toEqual(['Base Set', 'Jungle'])
    const subjects = byId.get('subjects')!.items
    expect(subjects[0]?.value).toBe(2)
    expect(subjects.slice(0, 2).map((i) => i.node.label).sort()).toEqual(['Electrode', 'Pikachu'])
    expect(byId.get('artists')?.items[0]?.node.nodeType).toBe('artist')
    for (const category of landmarks!.categories) {
      expect(category.items.length).toBeLessThanOrEqual(6)
      for (const item of category.items) expect(item.reason.length).toBeGreaterThan(0)
    }
  })

  it('answers null for a game that is not in the sky', async () => {
    expect(await getLandmarks(db.db, 'nope')).toBeNull()
  })
})
