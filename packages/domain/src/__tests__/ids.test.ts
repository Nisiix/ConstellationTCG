import { describe, expect, it } from 'vitest'
import { isNodeId, makeNodeId, parseNodeId } from '../ids'

describe('node ids', () => {
  it('round-trips type and entity id', () => {
    const id = makeNodeId('card_printing', 'abc-123')
    expect(id).toBe('card_printing:abc-123')
    expect(parseNodeId(id)).toEqual({ type: 'card_printing', entityId: 'abc-123' })
  })

  it('rejects malformed or unknown ids', () => {
    expect(parseNodeId('')).toBeNull()
    expect(parseNodeId('card_printing')).toBeNull()
    expect(parseNodeId('card_printing:')).toBeNull()
    expect(parseNodeId('unknown_type:abc')).toBeNull()
    expect(isNodeId('set:xyz')).toBe(true)
    expect(isNodeId(42)).toBe(false)
  })
})
