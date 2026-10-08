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
      { kind: 'mechanic', key: 'attack:fire-spin', relation: 'HAS_ATTACK', nodeId: 'mechanic:fs', metadata: {} },
    ],
    identityNodeIdByName: (name) => (name === 'charmeleon' ? 'card_identity:charmeleon' : null),
    entityNodeIdByKey: () => null,
    ...overrides,
  }
}

describe('buildRelationships', () => {
  it('emits catalog, artist, entity and evolution edges for a printing', () => {
    const rels = buildRelationships(context())
    const pairs = rels.map((r) => `${r.relationshipType} ${r.sourceNodeId} -> ${r.targetNodeId}`)
    expect(pairs).toContain('BELONGS_TO card_printing:p1 -> set:base1')
    expect(pairs).toContain('PRINTING_OF card_printing:p1 -> card_identity:charizard')
    expect(pairs).toContain('ILLUSTRATED_BY card_printing:p1 -> artist:arita')
    expect(pairs).toContain('SAME_POKEMON card_printing:p1 -> pokemon:6')
    expect(pairs).toContain('HAS_TYPE card_printing:p1 -> attribute:fire')
    expect(pairs).toContain('WEAK_TO card_printing:p1 -> attribute:water')
    expect(pairs).toContain('HAS_ATTACK card_printing:p1 -> mechanic:fs')
    expect(pairs).toContain('EVOLVES_FROM card_printing:p1 -> card_identity:charmeleon')
    expect(pairs).toContain('EVOLUTION_OF card_identity:charizard -> card_identity:charmeleon')
    expect(rels.find((r) => r.relationshipType === 'WEAK_TO')?.metadata).toEqual({ value: '×2' })
    expect(rels.every((r) => typeof r.weight === 'number' && r.weight > 0)).toBe(true)
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
