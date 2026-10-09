import type { RelationshipContext } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { buildRelationships } from '../relationships'

function context(overrides: Partial<RelationshipContext> = {}): RelationshipContext {
  return {
    gameNodeId: 'game:g',
    printing: {
      nodeId: 'card_printing:p1',
      identityNodeId: 'card_identity:charizard',
      setNodeId: 'set:base1',
      seriesNodeId: 'series:base',
      artistNodeId: 'artist:arita',
      externalId: 'base1-4',
      language: 'en',
      attributes: { evolveFrom: 'Charmeleon', hp: 120 },
      identityName: 'Charizard',
      identityNormalizedName: 'charizard',
    },
    entities: [
      { kind: 'pokemon', key: 'dex:6', relation: 'SAME_POKEMON', nodeId: 'pokemon:6', metadata: {} },
      { kind: 'attribute', key: 'type:fire', relation: 'HAS_TYPE', nodeId: 'attribute:fire', metadata: {} },
      {
        kind: 'attribute',
        key: 'type:water',
        relation: 'WEAK_TO',
        nodeId: 'attribute:water',
        metadata: { value: '×2' },
      },
      { kind: 'attribute', key: 'type:fighting', relation: 'RESISTS', nodeId: 'attribute:fighting', metadata: {} },
      { kind: 'mechanic', key: 'attack:fire-spin', relation: 'HAS_ATTACK', nodeId: 'mechanic:fs', metadata: {} },
      { kind: 'mechanic', key: 'ability:energy-burn', relation: 'HAS_ABILITY', nodeId: 'mechanic:eb', metadata: {} },
    ],
    identityNodeIdByName: (name) => (name === 'charmeleon' ? 'card_identity:charmeleon' : null),
    entityNodeIdByKey: () => null,
    setPrintingNodeIdsByName: () => [],
    ...overrides,
  }
}

const pairsOf = (ctx: RelationshipContext) => buildRelationships(ctx).map((r) => `${r.relationshipType} ${r.sourceNodeId} -> ${r.targetNodeId}`)

describe('buildRelationships', () => {
  it('emits catalog, artist, Pokémon and evolution edges for a printing', () => {
    const rels = buildRelationships(context())
    const pairs = pairsOf(context())
    expect(pairs).toContain('BELONGS_TO card_printing:p1 -> set:base1')
    expect(pairs).toContain('PRINTING_OF card_printing:p1 -> card_identity:charizard')
    expect(pairs).toContain('ILLUSTRATED_BY card_printing:p1 -> artist:arita')
    expect(pairs).toContain('SAME_POKEMON card_printing:p1 -> pokemon:6')
    expect(pairs).toContain('EVOLVES_FROM card_printing:p1 -> card_identity:charmeleon')
    expect(pairs).toContain('EVOLUTION_OF card_identity:charizard -> card_identity:charmeleon')
    expect(rels.every((r) => typeof r.weight === 'number' && r.weight > 0)).toBe(true)
  })

  it('never connects cards through an energy type, a weakness, a resistance or card statistics', () => {
    const pairs = pairsOf(context())
    expect(pairs.some((p) => p.includes('attribute:'))).toBe(false)
    expect(pairs.some((p) => /^(HAS_TYPE|WEAK_TO|RESISTS|HAS_ATTRIBUTE) /.test(p))).toBe(false)
    // Stale attack or ability links (from an older ingestion) never become edges either.
    expect(pairs.some((p) => p.includes('mechanic:'))).toBe(false)
  })

  it('links the evolution to the pre-evolution printed in the same set when there is one', () => {
    const pairs = pairsOf(
      context({ setPrintingNodeIdsByName: (name) => (name === 'charmeleon' ? ['card_printing:charmeleon-base1'] : []) }),
    )
    expect(pairs).toContain('EVOLVES_FROM card_printing:p1 -> card_printing:charmeleon-base1')
    expect(pairs).not.toContain('EVOLVES_FROM card_printing:p1 -> card_identity:charmeleon')
    // The identity-level evolution line stays.
    expect(pairs).toContain('EVOLUTION_OF card_identity:charizard -> card_identity:charmeleon')
  })

  it('omits optional edges when the data is missing', () => {
    const rels = buildRelationships(
      context({
        printing: {
          ...context().printing,
          artistNodeId: null,
          attributes: {},
        },
        entities: [],
      }),
    )
    const types = rels.map((r) => r.relationshipType)
    expect(types).toEqual(['BELONGS_TO', 'PRINTING_OF'])
  })

  it('does not emit evolution edges when the pre-evolution identity is unknown', () => {
    const rels = buildRelationships(context({ identityNodeIdByName: () => null }))
    expect(rels.some((r) => r.relationshipType === 'EVOLVES_FROM')).toBe(false)
    expect(rels.some((r) => r.relationshipType === 'EVOLUTION_OF')).toBe(false)
  })
})
