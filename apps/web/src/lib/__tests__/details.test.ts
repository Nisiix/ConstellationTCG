import type { GraphEdge, GraphNode } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { detailRows } from '../details'

function node(id: string, nodeType: GraphNode['nodeType'], metadata: Record<string, unknown> = {}): GraphNode {
  return { id, gameId: 'g', nodeType, entityId: id, label: id, subtitle: null, imageUrl: null, metadata }
}
function edge(sourceNodeId: string, relationshipType: string, targetNodeId: string): GraphEdge {
  return { id: `${sourceNodeId}|${relationshipType}|${targetNodeId}`, sourceNodeId, targetNodeId, relationshipType, weight: 1, direction: 'directed', metadata: {} }
}

describe('detailRows', () => {
  it('describes a printing in three groups — where it is printed, what it shows, its edition — and links its set and artist', () => {
    const printing = node('card_printing:1', 'card_printing', {
      setId: 'base1',
      setName: 'Base Set',
      printedNumber: '4/102',
      collectorNumber: '4',
      rarity: 'Rare',
      finish: 'holo',
      artist: 'Mitsuhiro Arita',
      types: ['Fire'],
      stage: 'Stage2',
      language: 'en',
      releaseDate: '1999-01-09',
      hp: 120,
    })
    const rows = detailRows(printing, [edge('card_printing:1', 'ILLUSTRATED_BY', 'artist:arita')])
    expect(rows.map((r) => [r.label, r.value, r.group])).toEqual([
      ['Set', 'Base Set', 'print'],
      ['Number', '4/102', 'print'],
      ['Rarity', 'Rare', 'print'],
      ['Finish', 'Holo', 'print'],
      ['Type', 'Fire', 'shows'],
      ['Stage', 'Stage2', 'shows'],
      ['Artist', 'Mitsuhiro Arita', 'shows'],
      ['Language', 'EN', 'edition'],
      ['Released', '09-01-1999', 'edition'],
    ])
    expect(rows.find((r) => r.label === 'Set')?.nodeId).toBe('set:base1')
    expect(rows.find((r) => r.label === 'Artist')?.nodeId).toBe('artist:arita')
    expect(rows.find((r) => r.label === 'Type')?.format).toBe('types')
    expect(rows.find((r) => r.label === 'Language')?.format).toBe('language')
    // statistics never become details
    expect(rows.map((r) => r.label)).not.toContain('HP')
  })

  it('finds the set of a printing through its BELONGS_TO edge when the metadata has no set id', () => {
    const printing = node('card_printing:1', 'card_printing', { setName: 'Base Set' })
    const rows = detailRows(printing, [edge('card_printing:1', 'BELONGS_TO', 'set:base1')])
    expect(rows.find((r) => r.label === 'Set')?.nodeId).toBe('set:base1')
  })

  it('links a set to its series through the PART_OF edge and no longer counts imported printings', () => {
    const set = node('set:base1', 'set', { seriesName: 'Base', releaseDate: '1999-01-09', cardCountOfficial: 102, printingCount: 102 })
    const rows = detailRows(set, [edge('set:base1', 'PART_OF', 'series:base')])
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ['Series', 'Base'],
      ['Released', '09-01-1999'],
      ['Cards', '102'],
    ])
    expect(rows.find((r) => r.label === 'Series')?.nodeId).toBe('series:base')
    expect(rows.every((r) => r.group === 'facts')).toBe(true)
  })

  it('leaves a value unlinked when its point is not in the neighborhood', () => {
    const set = node('set:base1', 'set', { seriesName: 'Base' })
    expect(detailRows(set).find((r) => r.label === 'Series')?.nodeId).toBeUndefined()
  })

  it('drops empty values and dates it cannot read', () => {
    const identity = node('card_identity:1', 'card_identity', { printingCount: 3, entityType: 'character', firstReleaseDate: 'unknown' })
    expect(detailRows(identity).map((r) => [r.label, r.value])).toEqual([
      ['Printings', '3'],
      ['Kind', 'character'],
    ])
    const series = node('series:1', 'series', { setCount: 4, releaseDate: '2000-04-24' })
    expect(detailRows(series).map((r) => [r.label, r.value])).toEqual([
      ['Sets', '4'],
      ['Released', '24-04-2000'],
    ])
  })
})
