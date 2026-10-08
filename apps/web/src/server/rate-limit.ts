import 'server-only'
import { NextResponse } from 'next/server'

/**
 * A small token bucket per client for the public API: enough for a person exploring (prefetch
 * included), not for a scraper. In-process; a multi-instance deployment should put a shared
 * limiter at the edge instead.
 */
import { TokenBucket, type BucketOptions } from '@/lib/token-bucket'

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, TokenBucket>()

  constructor(
    private readonly options: BucketOptions,
    private readonly now: () => number = () => Date.now(),
    private readonly maxClients = 10_000,
  ) {}

  /** Take one token for `key`; returns how many are left, or -1 when the bucket is empty. */
  take(key: string): number {
    const t = this.now()
    let bucket = this.buckets.get(key)
    if (!bucket) {
      if (this.buckets.size >= this.maxClients) {
        const oldest = this.buckets.keys().next().value
        if (oldest !== undefined) this.buckets.delete(oldest)
      }
      bucket = new TokenBucket(this.options, t)
      this.buckets.set(key, bucket)
    }
    return bucket.take(t)
  }
}

const globalRef = globalThis as unknown as { __constellationLimiter?: TokenBucketLimiter }

export function getLimiter(): TokenBucketLimiter {
  if (!globalRef.__constellationLimiter) {
    globalRef.__constellationLimiter = new TokenBucketLimiter({ ratePerSecond: 20, burst: 60 })
  }
  return globalRef.__constellationLimiter
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') ?? 'local'
}

/** `null` when the request may proceed, otherwise a 429 response to return as is. */
export function rateLimit(request: Request): NextResponse | null {
  const left = getLimiter().take(clientKey(request))
  if (left >= 0) return null
  return NextResponse.json(
    { error: { layer: 'rate_limit', message: 'Too many requests, slow down a little.' } },
    { status: 429, headers: { 'Retry-After': '2', 'Cache-Control': 'no-store' } },
  )
}
