import type { GraphEdge, GraphNode, NodeType } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { neighbours, pathNeighborhood, stepLabel, stepPhrase, type PathResponse } from '../path-steps'

const node = (id: string, label: string, nodeType: NodeType): GraphNode => ({
  id,
  gameId: 'g',
  nodeType,
  entityId: id,
  label,
  subtitle: null,
  imageUrl: null,
  metadata: {},
})
const edge = (id: string, source: string, target: string, relationshipType: string): GraphEdge => ({
  id,
  sourceNodeId: source,
  targetNodeId: target,
  relationshipType,
  weight: 1,
  direction: 'directed',
  metadata: {},
})

const charizard = node('card_printing:1', 'Charizard', 'card_printing')
const arita = node('artist:1', 'Mitsuhiro Arita', 'artist')
const pikachu = node('card_printing:2', 'Pikachu', 'card_printing')
const path: PathResponse = {
  found: true,
  from: charizard,
  to: pikachu,
  maxDepth: 6,
  visited: 10,
  nodes: [charizard, arita, pikachu],
  edges: [edge('e1', charizard.id, arita.id, 'ILLUSTRATED_BY'), edge('e2', pikachu.id, arita.id, 'ILLUSTRATED_BY')],
}

describe('path steps', () => {
  it('reads each connection in the direction of the path', () => {
    expect(stepLabel(path.edges[0]!, charizard, arita)).toBe('Charizard — illustrated by → Mitsuhiro Arita')
    expect(stepLabel(path.edges[1]!, arita, pikachu)).toBe('Mitsuhiro Arita — illustrated → Pikachu')
    expect(stepPhrase(edge('e', 'a', 'b', 'BELONGS_TO'), 'b')).toBe('contains')
    expect(stepPhrase(edge('e', 'a', 'b', 'REPRINT_OF'), 'a')).toBe('reprint of')
    expect(stepPhrase(edge('e', 'a', 'b', 'SOMETHING_NEW'), 'a')).toBe('something new')
  })

  it('turns the path into a sky around the step in hand', () => {
    const sky = pathNeighborhood(path, arita.id)
    expect(sky.focus.id).toBe(arita.id)
    expect(sky.meta.distances).toEqual({ [charizard.id]: 1, [arita.id]: 0, [pikachu.id]: 1 })
    expect(sky.nodes).toHaveLength(3)
    expect(pathNeighborhood(path, 'unknown').focus.id).toBe(charizard.id)
  })

  it('knows the step before and after', () => {
    expect(neighbours(path, charizard.id)).toEqual({ previous: null, next: arita.id, index: 0 })
    expect(neighbours(path, arita.id)).toEqual({ previous: charizard.id, next: pikachu.id, index: 1 })
    expect(neighbours(path, pikachu.id)).toEqual({ previous: arita.id, next: null, index: 2 })
  })
})
