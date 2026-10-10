import type { GraphEdge, GraphNode } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { nextStep, previousStep, timeSteps, visibilityAt, yearsOf } from '../time'

const node = (id: string, metadata: Record<string, unknown> = {}): GraphNode => ({
  id,
  gameId: 'g',
  nodeType: 'set',
  entityId: id,
  label: id,
  subtitle: null,
  imageUrl: null,
  metadata,
})
const edge = (s: string, t: string): GraphEdge => ({ id: `${s}>${t}`, sourceNodeId: s, targetNodeId: t, relationshipType: 'X', weight: 1, direction: 'directed', metadata: {} })

describe('the sky in time', () => {
  const nodes = [
    node('game'),
    node('base', { releaseDate: '1999-01-09' }),
    node('jungle', { releaseDate: '1999-06-16' }),
    node('neo', { releaseDate: '2000-12-16' }),
    node('card', { firstReleaseDate: '2000-03-01' }),
    node('artist'),
    node('alone'),
  ]
  const edges = [edge('base', 'game'), edge('neo', 'game'), edge('card', 'artist'), edge('neo', 'artist')]

  it('dates every point by its own release, else by its earliest dated connection', () => {
    const years = yearsOf(nodes, edges)
    expect(years.get('base')).toBe(1999)
    expect(years.get('card')).toBe(2000)
    expect(years.get('artist')).toBe(2000)
    // The game is connected to Base Set: it arrives with it. A point with no dated connection is timeless.
    expect(years.get('game')).toBe(1999)
    expect(years.has('alone')).toBe(false)
    expect(timeSteps(years)).toEqual([1999, 2000])
  })

  it('hides what had not appeared yet and marks what appeared that year, never the focus', () => {
    const years = yearsOf(nodes, edges)
    const at1999 = visibilityAt(years, 1999, 'game')
    expect([...at1999.hidden].sort()).toEqual(['artist', 'card', 'neo'])
    expect([...at1999.fresh].sort()).toEqual(['base', 'jungle'])
    expect(visibilityAt(years, 1990, 'neo').hidden.has('neo')).toBe(false)
    expect(visibilityAt(years, null, 'game').hidden.size).toBe(0)
  })

  it('steps through the years that hold something, and stops at the ends', () => {
    expect(nextStep([1999, 2000, 2003], null)).toBe(1999)
    expect(nextStep([1999, 2000, 2003], 2000)).toBe(2003)
    expect(nextStep([1999, 2000, 2003], 2003)).toBeNull()
    expect(nextStep([1999, 2000, 2003], 2001)).toBe(2003)
    expect(previousStep([1999, 2000, 2003], 2003)).toBe(2000)
    expect(previousStep([1999, 2000, 2003], 1999)).toBeNull()
    expect(previousStep([1999, 2000, 2003], null)).toBe(2003)
    expect(nextStep([], null)).toBeNull()
  })
})
