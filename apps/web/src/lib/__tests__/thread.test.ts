import type { GraphNode } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { THREAD_LIT_STEPS, THREAD_MAX_STEPS, parseStoredThread, recordStep, stepBrightness, syncPositions, walkThread } from '../thread'

const node = (id: string, label = id): GraphNode => ({
  id,
  gameId: 'g',
  nodeType: 'card_printing',
  entityId: id,
  label,
  subtitle: null,
  imageUrl: null,
  metadata: {},
})

describe('thread', () => {
  it('adds a step per new focus and never repeats the last one', () => {
    let steps = recordStep([], node('a'), [0, 0, 0])
    steps = recordStep(steps, node('b'), [1, 0, 0])
    const same = recordStep(steps, node('b'), [1, 0, 0])
    expect(same).toBe(steps)
    steps = recordStep(steps, node('a'), [0, 0, 0])
    expect(steps.map((s) => s.id)).toEqual(['a', 'b', 'a'])
  })

  it('keeps the latest steps when the session runs long', () => {
    let steps = recordStep([], node('n0'), null)
    for (let i = 1; i < THREAD_MAX_STEPS + 5; i += 1) steps = recordStep(steps, node(`n${i}`), null)
    expect(steps).toHaveLength(THREAD_MAX_STEPS)
    expect(steps.at(-1)?.id).toBe(`n${THREAD_MAX_STEPS + 4}`)
    expect(steps[0]?.id).toBe('n5')
  })

  it('remembers where steps on screen are drawn, and leaves the others where they were', () => {
    const steps = [recordStep([], node('a'), [0, 0, 0])[0]!, { ...recordStep([], node('b'), [5, 5, 5])[0]! }]
    const synced = syncPositions(steps, new Map([['a', [1, 2, 3] as [number, number, number]]]))
    expect(synced[0]?.position).toEqual([1, 2, 3])
    expect(synced[1]?.position).toEqual([5, 5, 5])
    expect(syncPositions(synced, new Map())).toBe(synced)
  })

  it('lights the last twelve steps fully and fades the older ones to a floor', () => {
    const count = 30
    expect(stepBrightness(count - 1, count)).toBe(1)
    expect(stepBrightness(count - THREAD_LIT_STEPS, count)).toBe(1)
    expect(stepBrightness(count - THREAD_LIT_STEPS - 1, count)).toBeLessThan(1)
    expect(stepBrightness(0, count)).toBeGreaterThanOrEqual(0.18)
    expect(stepBrightness(0, count)).toBeLessThan(stepBrightness(16, count))
  })

  it('walks back and forth along the thread with the keyboard, within its ends', () => {
    expect(walkThread(3, null, -1)).toBe(1)
    expect(walkThread(3, 1, -1)).toBe(0)
    expect(walkThread(3, 0, -1)).toBeNull()
    expect(walkThread(3, 0, 1)).toBe(1)
    expect(walkThread(3, 2, 1)).toBeNull()
    expect(walkThread(3, null, 1)).toBeNull()
    expect(walkThread(1, null, -1)).toBeNull()
  })

  it('reads a stored thread defensively', () => {
    expect(parseStoredThread(null)).toEqual([])
    expect(parseStoredThread('not json')).toEqual([])
    expect(parseStoredThread('{"a":1}')).toEqual([])
    const stored = JSON.stringify([{ id: 'a', label: 'A', nodeType: 'set', subtitle: null, position: [1, 2, 3] }, { nope: true }])
    expect(parseStoredThread(stored)).toEqual([{ id: 'a', label: 'A', nodeType: 'set', subtitle: null, position: [1, 2, 3] }])
  })
})
