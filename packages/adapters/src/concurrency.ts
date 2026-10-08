/**
 * Map over `items` with at most `limit` tasks in flight. Order of results matches input order.
 * Errors propagate (the caller decides whether a failed record blocks the run).
 */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index] as T, index)
    }
  })
  await Promise.all(workers)
  return results
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RetryOptions {
  retries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

/** Exponential backoff with jitter. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 4
  const base = options.baseDelayMs ?? 300
  const max = options.maxDelayMs ?? 8_000
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (error) {
      attempt += 1
      const retry = options.shouldRetry ? options.shouldRetry(error, attempt) : true
      if (!retry || attempt > retries) throw error
      const delay = Math.min(max, base * 2 ** (attempt - 1)) * (0.75 + Math.random() * 0.5)
      options.onRetry?.(error, attempt, delay)
      await sleep(delay)
    }
  }
}
