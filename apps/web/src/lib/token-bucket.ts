/** Pure token bucket (shared with the server limiter's tests; no server-only imports here). */
export interface BucketOptions {
  ratePerSecond: number
  burst: number
}

export class TokenBucket {
  private tokens: number
  private updatedAt: number

  constructor(
    private readonly options: BucketOptions,
    now: number,
  ) {
    this.tokens = options.burst
    this.updatedAt = now
  }

  take(now: number): number {
    const elapsed = Math.max(0, now - this.updatedAt) / 1000
    this.tokens = Math.min(this.options.burst, this.tokens + elapsed * this.options.ratePerSecond)
    this.updatedAt = now
    if (this.tokens < 1) return -1
    this.tokens -= 1
    return Math.floor(this.tokens)
  }
}
