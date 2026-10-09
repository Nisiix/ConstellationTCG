import { cardPrintings, eq, graphEdges, graphNodes, tcgGames, tcgSets, type Database } from '@constellation/database'
import type { TCGAdapter } from '@constellation/domain'
import { createSeededDatabase } from '@constellation/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildGraphProjection } from '../builder'
import { planGraphBuild, runGraphStep, type GraphStep } from '../incremental'

let database: Database
let adapter: TCGAdapter
let gameId: string
let registry: Awaited<ReturnType<typeof createSeededDatabase>>['registry']

type NodeRow = typeof graphNodes.$inferSelect
type EdgeRow = typeof graphEdges.$inferSelect

function nodeSnapshot(rows: NodeRow[]) {
  return rows
    .map(({ buildId: _build, createdAt: _c, updatedAt: _u, ...rest }) => rest)
    .sort((a, b) => a.id.localeCompare(b.id))
}

function edgeSnapshot(rows: EdgeRow[]) {
  return rows
    .map(({ buildId: _build, createdAt: _c, ...rest }) => rest)
    .sort((a, b) => a.id.localeCompare(b.id))
}

async function runAll(buildId: string, pages: { identityPageSize: number; reprintPageSize: number }): Promise<GraphStep[]> {
  const steps: GraphStep[] = [{ kind: 'scaffold' }, ...(await planGraphBuild(database.db, gameId, pages))]
  for (const step of steps) await runGraphStep({ database, adapter, gameId, buildId, step })
  return steps
}

beforeAll(async () => {
  const seeded = await createSeededDatabase()
  database = seeded.database
  registry = seeded.registry
  const found = registry.bySlug('pokemon')
  if (!found) throw new Error('adapter missing')
  adapter = found
  const [game] = await database.db.select().from(tcgGames)
  if (!game) throw new Error('game missing')
  gameId = game.id
})

afterAll(async () => {
  await database.close()
})

describe('resumable graph build', () => {
  it('produces exactly the projection of the one-shot builder, step by step, with tiny pages', async () => {
    await buildGraphProjection({ database, registry })
    const expectedNodes = nodeSnapshot(await database.db.select().from(graphNodes))
    const expectedEdges = edgeSnapshot(await database.db.select().from(graphEdges))
    expect(expectedNodes.length).toBeGreaterThan(250)
    expect(expectedEdges.length).toBeGreaterThan(500)

    await database.db.delete(graphNodes)
    expect(await database.db.select().from(graphEdges)).toHaveLength(0)

    const steps = await runAll('build-1', { identityPageSize: 30, reprintPageSize: 40 })
    expect(steps.filter((s) => s.kind === 'identities').length).toBeGreaterThan(1)
    expect(steps.filter((s) => s.kind === 'printings')).toHaveLength(1)
    expect(steps.filter((s) => s.kind === 'reprints').length).toBeGreaterThan(1)
    expect(steps.at(-1)?.kind).toBe('finish')

    const nodes = await database.db.select().from(graphNodes)
    const edges = await database.db.select().from(graphEdges)
    expect(nodeSnapshot(nodes)).toEqual(expectedNodes)
    expect(edgeSnapshot(edges)).toEqual(expectedEdges)
    expect(nodes.every((n) => n.buildId === 'build-1')).toBe(true)
    expect(edges.every((e) => e.buildId === 'build-1')).toBe(true)
  })

  it('updates the projection in place and removes what the catalog no longer has', async () => {
    const [base] = await database.db.select().from(tcgSets).where(eq(tcgSets.externalId, 'base1'))
    const [charizard] = await database.db.select().from(cardPrintings).where(eq(cardPrintings.externalId, 'base1-4'))
    if (!base || !charizard) throw new Error('fixture rows missing')

    // A reprint appears in a later set.
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
    const [reprint] = await database.db
      .insert(cardPrintings)
      .values({
        identityId: charizard.identityId,
        setId: later.id,
        sourceId: charizard.sourceId,
        externalId: 'base4-4',
        collectorNumber: '4',
        printedNumber: '4/130',
        rarity: charizard.rarity,
        artistId: charizard.artistId,
        imageFront: charizard.imageFront,
        attributes: charizard.attributes,
        rawDataHash: 'test-base4-4',
      })
      .returning()
    if (!reprint) throw new Error('printing not created')

    await runAll('build-2', { identityPageSize: 500, reprintPageSize: 500 })
    const afterAdd = await database.db.select().from(graphEdges)
    const reprints = afterAdd.filter((e) => e.relationshipType === 'REPRINT_OF')
    expect(reprints).toHaveLength(1)
    expect(reprints[0]?.sourceNodeId).toBe(`card_printing:${reprint.id}`)
    expect(reprints[0]?.targetNodeId).toBe(`card_printing:${charizard.id}`)
    const nodesAfterAdd = await database.db.select().from(graphNodes)
    expect(nodesAfterAdd.some((n) => n.id === `set:${later.id}`)).toBe(true)
    expect(nodesAfterAdd.find((n) => n.id === `card_identity:${charizard.identityId}`)?.subtitle).toBe('2 printings')
    expect(nodesAfterAdd.every((n) => n.buildId === 'build-2')).toBe(true)

    // The reprint disappears from the catalog: its node and edges go, nothing else changes.
    await database.db.delete(cardPrintings).where(eq(cardPrintings.id, reprint.id))
    await runAll('build-3', { identityPageSize: 500, reprintPageSize: 500 })
    const nodesAfterRemove = await database.db.select().from(graphNodes)
    const edgesAfterRemove = await database.db.select().from(graphEdges)
    expect(nodesAfterRemove.some((n) => n.id === `card_printing:${reprint.id}`)).toBe(false)
    expect(edgesAfterRemove.some((e) => e.relationshipType === 'REPRINT_OF')).toBe(false)
    expect(nodesAfterRemove.some((n) => n.id === `set:${later.id}`)).toBe(true)
    expect(nodesAfterRemove.find((n) => n.id === `card_identity:${charizard.identityId}`)?.subtitle).toBe('1 printing')
    expect(nodesAfterRemove.every((n) => n.buildId === 'build-3')).toBe(true)
    expect(edgesAfterRemove.every((e) => e.buildId === 'build-3')).toBe(true)

    // And it still equals what the one-shot builder would write now.
    const stepwiseNodes = nodeSnapshot(nodesAfterRemove)
    const stepwiseEdges = edgeSnapshot(edgesAfterRemove)
    await buildGraphProjection({ database, registry })
    expect(nodeSnapshot(await database.db.select().from(graphNodes))).toEqual(stepwiseNodes)
    expect(edgeSnapshot(await database.db.select().from(graphEdges))).toEqual(stepwiseEdges)
  })
})
