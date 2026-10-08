import { describe, expect, it } from 'vitest'
import { TokenBucket } from '../token-bucket'

describe('token bucket', () => {
  it('allows a burst, then refills at the configured rate', () => {
    const bucket = new TokenBucket({ ratePerSecond: 2, burst: 3 }, 0)
    expect(bucket.take(0)).toBe(2)
    expect(bucket.take(0)).toBe(1)
    expect(bucket.take(0)).toBe(0)
    expect(bucket.take(0)).toBe(-1)
    // half a second later: one token back
    expect(bucket.take(500)).toBe(0)
    expect(bucket.take(500)).toBe(-1)
    // never above the burst
    expect(bucket.take(60_000)).toBe(2)
  })
})
