import type { GraphEdge, GraphNode } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { buildRelationshipGroups, sortGroupItems } from '../useRelationshipGroups'

function node(id: string, nodeType: GraphNode['nodeType'], metadata: Record<string, unknown> = {}): GraphNode {
  return { id, gameId: 'g', nodeType, entityId: id, label: id, subtitle: null, imageUrl: null, metadata }
}
const item = (n: GraphNode, weight = 1) => ({ node: n, weight, metadata: {} })

describe('relationship group ordering', () => {
  it('lists expansions from the most recent to the oldest', () => {
    const series = node('series:base', 'series')
    const items = [
      item(node('set:base1', 'set', { releaseDate: '1999-01-09' })),
      item(node('set:base5', 'set', { releaseDate: '2000-04-24' })),
      item(node('set:base2', 'set', { releaseDate: '1999-06-16' })),
      item(node('set:wp', 'set', {})),
    ]
    expect(sortGroupItems(items, series).map((i) => i.node.id)).toEqual(['set:base5', 'set:base2', 'set:base1', 'set:wp'])
  })

  it('lists the printings of a card newest first', () => {
    const identity = node('card_identity:charizard', 'card_identity')
    const items = [
      item(node('p:1999', 'card_printing', { releaseDate: '1999-01-09' })),
      item(node('p:2016', 'card_printing', { releaseDate: '2016-11-02' })),
    ]
    expect(sortGroupItems(items, identity).map((i) => i.node.id)).toEqual(['p:2016', 'p:1999'])
  })

  it('lists the cards of a set by collector number', () => {
    const set = node('set:base1', 'set')
    const items = [
      item(node('p:10', 'card_printing', { collectorNumber: '10' })),
      item(node('p:2', 'card_printing', { collectorNumber: '2' })),
      item(node('p:1', 'card_printing', { collectorNumber: '1' })),
    ]
    expect(sortGroupItems(items, set).map((i) => i.node.id)).toEqual(['p:1', 'p:2', 'p:10'])
  })

  it('orders everything else by relationship strength, then name', () => {
    const focus = node('card_printing:x', 'card_printing')
    const items = [item(node('b', 'attribute'), 0.3), item(node('a', 'attribute'), 0.3), item(node('c', 'attribute'), 0.9)]
    expect(sortGroupItems(items, focus).map((i) => i.node.id)).toEqual(['c', 'a', 'b'])
  })
})

function edge(sourceNodeId: string, relationshipType: string, targetNodeId: string): GraphEdge {
  return { id: `${sourceNodeId}|${relationshipType}|${targetNodeId}`, sourceNodeId, targetNodeId, relationshipType, weight: 1, direction: 'directed', metadata: {} }
}

describe('relationship groups', () => {
  const set = node('set:base1', 'set')
  const series = node('series:base', 'series')
  const card = node('p:1', 'card_printing')
  const edges = [edge('set:base1', 'PART_OF', 'series:base'), edge('p:1', 'BELONGS_TO', 'set:base1')]

  it('hides "Part of": the parent is named (and linked) in the details', () => {
    const { groups } = buildRelationshipGroups(
      'set:base1',
      [set, series, card],
      edges,
      [
        { relationshipType: 'PART_OF', direction: 'out', count: 1 },
        { relationshipType: 'BELONGS_TO', direction: 'in', count: 102 },
      ],
    )
    expect(groups.map((g) => g.label)).toEqual(['Cards'])
    expect(groups[0]?.total).toBe(102)
  })

  it('keeps "Contains": what a series holds is a connection worth listing', () => {
    const { groups } = buildRelationshipGroups('series:base', [set, series], edges, [])
    expect(groups.map((g) => [g.label, g.items.map((i) => i.node.id)])).toEqual([['Contains', ['set:base1']]])
  })

  it('does not resurrect a hidden group from the summary alone', () => {
    const { groups } = buildRelationshipGroups('series:base', [series], [], [{ relationshipType: 'PART_OF', direction: 'out', count: 1 }])
    expect(groups).toEqual([])
  })
})
