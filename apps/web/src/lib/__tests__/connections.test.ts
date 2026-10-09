import type { GraphEdge, GraphNode } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { bridgeLabel, groupFarNodes } from '../connections'

function node(id: string, nodeType: GraphNode['nodeType'], label = id): GraphNode {
  return { id, gameId: 'g', nodeType, entityId: id, label, subtitle: null, imageUrl: null, metadata: {} }
}
function edge(sourceNodeId: string, relationshipType: string, targetNodeId: string): GraphEdge {
  return { id: `${sourceNodeId}|${relationshipType}|${targetNodeId}`, sourceNodeId, targetNodeId, relationshipType, weight: 1, direction: 'directed', metadata: {} }
}

/** Charizard in focus, three steps deep. */
const focus = node('p:charizard', 'card_printing', 'Charizard')
const base = node('set:base', 'set', 'Base Set')
const arita = node('artist:arita', 'artist', 'Mitsuhiro Arita')
const identity = node('ci:charizard', 'card_identity', 'Charizard')
const charmeleon = node('p:charmeleon', 'card_printing', 'Charmeleon')
const pikachu = node('p:pikachu', 'card_printing', 'Pikachu')
const bulbasaur = node('p:bulbasaur', 'card_printing', 'Bulbasaur')
const charizard2 = node('p:charizard-2', 'card_printing', 'Charizard')
const charmander = node('p:charmander', 'card_printing', 'Charmander')
const jungle = node('set:jungle', 'set', 'Jungle')

const nodes = [focus, base, arita, identity, charmeleon, pikachu, bulbasaur, charizard2, charmander, jungle]
const edges = [
  edge('p:charizard', 'BELONGS_TO', 'set:base'),
  edge('p:charizard', 'ILLUSTRATED_BY', 'artist:arita'),
  edge('p:charizard', 'PRINTING_OF', 'ci:charizard'),
  edge('p:charizard', 'EVOLVES_FROM', 'p:charmeleon'),
  // two steps away
  edge('p:pikachu', 'BELONGS_TO', 'set:base'),
  edge('p:pikachu', 'ILLUSTRATED_BY', 'artist:arita'),
  edge('p:bulbasaur', 'ILLUSTRATED_BY', 'artist:arita'),
  edge('p:charizard-2', 'PRINTING_OF', 'ci:charizard'),
  edge('p:charmeleon', 'EVOLVES_FROM', 'p:charmander'),
  // three steps away
  edge('p:bulbasaur', 'BELONGS_TO', 'set:jungle'),
]
const distances: Record<string, number> = {
  'p:charizard': 0,
  'set:base': 1,
  'artist:arita': 1,
  'ci:charizard': 1,
  'p:charmeleon': 1,
  'p:pikachu': 2,
  'p:bulbasaur': 2,
  'p:charizard-2': 2,
  'p:charmander': 2,
  'set:jungle': 3,
}

describe('groupFarNodes', () => {
  const sections = groupFarNodes(nodes, edges, distances, focus.id)

  it('sections the far points by the connection that brought them in, in the connection order', () => {
    expect(sections.map((s) => s.label)).toEqual([
      'Same card · Charizard',
      'Same set · Base Set',
      'Through the artist · Mitsuhiro Arita',
      'Charmeleon → Evolves from',
    ])
    expect(sections.map((s) => s.bridge?.id)).toEqual(['ci:charizard', 'set:base', 'artist:arita', 'p:charmeleon'])
  })

  it('lists each far point once, under its first bridge only', () => {
    // Pikachu shares both the set and the artist: the set comes first.
    const bySet = sections.find((s) => s.label === 'Same set · Base Set')
    const byArtist = sections.find((s) => s.label === 'Through the artist · Mitsuhiro Arita')
    expect(bySet?.nodes.map((n) => n.id)).toEqual(['p:pikachu'])
    expect(byArtist?.nodes.map((n) => n.id)).not.toContain('p:pikachu')
    const all = sections.flatMap((s) => s.nodes.map((n) => n.id))
    expect(new Set(all).size).toBe(all.length)
    expect(all.sort()).toEqual(['p:bulbasaur', 'p:charizard-2', 'p:charmander', 'p:pikachu', 'set:jungle'])
  })

  it('files a third step under the bridge of the point it hangs from', () => {
    const byArtist = sections.find((s) => s.label === 'Through the artist · Mitsuhiro Arita')
    expect(byArtist?.nodes.map((n) => n.id)).toEqual(['p:bulbasaur', 'set:jungle'])
  })

  it('leaves the focus and its direct connections out', () => {
    const all = sections.flatMap((s) => s.nodes.map((n) => n.id))
    expect(all).not.toContain('p:charizard')
    expect(all).not.toContain('set:base')
  })

  it('is empty when nothing is further than one step', () => {
    expect(groupFarNodes([focus, base], edges.slice(0, 1), { 'p:charizard': 0, 'set:base': 1 }, focus.id)).toEqual([])
  })

  it('names the series that sibling sets share with a set in focus', () => {
    const set = node('set:base1', 'set', 'Base Set')
    const series = node('series:base', 'series', 'Base')
    const sibling = node('set:jungle', 'set', 'Jungle')
    const result = groupFarNodes(
      [set, series, sibling],
      [edge('set:base1', 'PART_OF', 'series:base'), edge('set:jungle', 'PART_OF', 'series:base')],
      { 'set:base1': 0, 'series:base': 1, 'set:jungle': 2 },
      set.id,
    )
    expect(result.map((s) => [s.label, s.nodes.map((n) => n.id)])).toEqual([['Same series · Base', ['set:jungle']]])
  })

  it('puts a far point without a path to the focus under "Other connections", last', () => {
    const stray = node('p:stray', 'card_printing', 'Stray')
    const result = groupFarNodes([focus, base, pikachu, stray], edges, { ...distances, 'p:stray': 2 }, focus.id)
    expect(result.map((s) => s.label)).toEqual(['Same set · Base Set', 'Other connections'])
    expect(result[1]?.nodes.map((n) => n.id)).toEqual(['p:stray'])
  })
})

describe('bridgeLabel', () => {
  it('says what the far points share when they hang from the same hub', () => {
    expect(bridgeLabel('BELONGS_TO', 'target', base)).toBe('Same set · Base Set')
    expect(bridgeLabel('ILLUSTRATED_BY', 'target', arita)).toBe('Through the artist · Mitsuhiro Arita')
    expect(bridgeLabel('HAS_TYPE', 'target', node('attr:fire', 'attribute', 'Fire'))).toBe('Same energy type · Fire')
    expect(bridgeLabel('SAME_POKEMON', 'target', node('pokemon:6', 'pokemon', 'Charizard'))).toBe('Same Pokémon · Charizard')
    expect(bridgeLabel('REPRINT_OF', 'target', focus)).toBe('Reprints · Charizard')
    expect(bridgeLabel('PART_OF', 'target', node('game:pokemon', 'game', 'Pokémon'))).toBe('Same game · Pokémon')
  })

  it('otherwise reads the connection from the bridge, as the tooltip does', () => {
    expect(bridgeLabel('BELONGS_TO', 'source', charmeleon)).toBe('Charmeleon → Set')
    expect(bridgeLabel('EVOLVES_FROM', 'target', charmeleon)).toBe('Charmeleon → Evolves into')
  })
})
