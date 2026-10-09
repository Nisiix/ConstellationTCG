import type { GraphEdge, GraphNode } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { bridgeLabel, groupFarNodes } from '../connections'

function node(id: string, nodeType: GraphNode['nodeType'], label = id): GraphNode {
  return { id, gameId: 'g', nodeType, entityId: id, label, subtitle: null, imageUrl: null, metadata: {} }
}
function edge(sourceNodeId: string, relationshipType: string, targetNodeId: string): GraphEdge {
  return { id: `${sourceNodeId}|${relationshipType}|${targetNodeId}`, sourceNodeId, targetNodeId, relationshipType, weight: 1, direction: 'directed', metadata: {} }
}

/** Charizard in focus, two steps deep: the set is a direct connection that does not open. */
const focus = node('p:charizard', 'card_printing', 'Charizard')
const base = node('set:base', 'set', 'Base Set')
const arita = node('artist:arita', 'artist', 'Mitsuhiro Arita')
const identity = node('ci:charizard', 'card_identity', 'Charizard')
const species = node('pokemon:6', 'pokemon', 'Charizard')
const charmeleon = node('p:charmeleon', 'card_printing', 'Charmeleon')
const charizardEx = node('p:charizard-ex', 'card_printing', 'Charizard ex')
const bulbasaur = node('p:bulbasaur', 'card_printing', 'Bulbasaur')
const charizard2 = node('p:charizard-2', 'card_printing', 'Charizard')
const charmander = node('p:charmander', 'card_printing', 'Charmander')

const nodes = [focus, base, arita, identity, species, charmeleon, charizardEx, bulbasaur, charizard2, charmander]
const edges = [
  edge('p:charizard', 'BELONGS_TO', 'set:base'),
  edge('p:charizard', 'ILLUSTRATED_BY', 'artist:arita'),
  edge('p:charizard', 'PRINTING_OF', 'ci:charizard'),
  edge('p:charizard', 'SAME_POKEMON', 'pokemon:6'),
  edge('p:charizard', 'EVOLVES_FROM', 'p:charmeleon'),
  // two steps away
  edge('p:charizard-ex', 'SAME_POKEMON', 'pokemon:6'),
  edge('p:charizard-ex', 'ILLUSTRATED_BY', 'artist:arita'),
  edge('p:bulbasaur', 'ILLUSTRATED_BY', 'artist:arita'),
  edge('p:charizard-2', 'PRINTING_OF', 'ci:charizard'),
  edge('p:charmeleon', 'EVOLVES_FROM', 'p:charmander'),
]
const distances: Record<string, number> = {
  'p:charizard': 0,
  'set:base': 1,
  'artist:arita': 1,
  'ci:charizard': 1,
  'pokemon:6': 1,
  'p:charmeleon': 1,
  'p:charizard-ex': 2,
  'p:bulbasaur': 2,
  'p:charizard-2': 2,
  'p:charmander': 2,
}

describe('groupFarNodes', () => {
  const sections = groupFarNodes(nodes, edges, distances, focus.id)

  it('sections the far points by the connection that brought them in, in the connection order', () => {
    expect(sections.map((s) => s.label)).toEqual([
      'Same card · Charizard',
      'Same Pokémon · Charizard',
      'Charmeleon → Evolves from',
      'Through the artist · Mitsuhiro Arita',
    ])
    expect(sections.map((s) => s.bridge?.id)).toEqual(['ci:charizard', 'pokemon:6', 'p:charmeleon', 'artist:arita'])
  })

  it('lists each far point once, under its first bridge only', () => {
    // Charizard ex shares both the Pokémon and the artist: the Pokémon comes first.
    const byPokemon = sections.find((s) => s.label === 'Same Pokémon · Charizard')
    const byArtist = sections.find((s) => s.label === 'Through the artist · Mitsuhiro Arita')
    expect(byPokemon?.nodes.map((n) => n.id)).toEqual(['p:charizard-ex'])
    expect(byArtist?.nodes.map((n) => n.id)).toEqual(['p:bulbasaur'])
    const all = sections.flatMap((s) => s.nodes.map((n) => n.id))
    expect(new Set(all).size).toBe(all.length)
    expect(all.sort()).toEqual(['p:bulbasaur', 'p:charizard-2', 'p:charizard-ex', 'p:charmander'])
  })

  it('leaves the focus and its direct connections out', () => {
    const all = sections.flatMap((s) => s.nodes.map((n) => n.id))
    expect(all).not.toContain('p:charizard')
    expect(all).not.toContain('set:base')
  })

  it('is empty when nothing is further than one step', () => {
    expect(groupFarNodes([focus, base], edges.slice(0, 1), { 'p:charizard': 0, 'set:base': 1 }, focus.id)).toEqual([])
  })

  it('puts a far point without a path to the focus under "Other connections", last', () => {
    const stray = node('p:stray', 'card_printing', 'Stray')
    const result = groupFarNodes([focus, arita, bulbasaur, stray], edges, { ...distances, 'p:stray': 2 }, focus.id)
    expect(result.map((s) => s.label)).toEqual(['Through the artist · Mitsuhiro Arita', 'Other connections'])
    expect(result[1]?.nodes.map((n) => n.id)).toEqual(['p:stray'])
  })
})

describe('bridgeLabel', () => {
  it('says what the far points share when they hang from the same hub', () => {
    expect(bridgeLabel('ILLUSTRATED_BY', 'target', arita)).toBe('Through the artist · Mitsuhiro Arita')
    expect(bridgeLabel('COUNTERPART_OF', 'target', charmeleon)).toBe('Same Pokémon, earlier sets · Charmeleon')
    expect(bridgeLabel('SAME_POKEMON', 'target', node('pokemon:6', 'pokemon', 'Charizard'))).toBe('Same Pokémon · Charizard')
    expect(bridgeLabel('REPRINT_OF', 'target', focus)).toBe('Reprints · Charizard')
    expect(bridgeLabel('PART_OF', 'target', node('game:pokemon', 'game', 'Pokémon'))).toBe('Same game · Pokémon')
  })

  it('never says "same set" or "same energy type": cards are not related for that', () => {
    expect(bridgeLabel('BELONGS_TO', 'target', base)).toBe('Base Set → Cards')
  })

  it('otherwise reads the connection from the bridge, as the tooltip does', () => {
    expect(bridgeLabel('BELONGS_TO', 'source', charmeleon)).toBe('Charmeleon → Set')
    expect(bridgeLabel('EVOLVES_FROM', 'target', charmeleon)).toBe('Charmeleon → Evolves into')
  })
})
