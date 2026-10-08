import 'server-only'

interface Entry<V> {
  value: V
  expiresAt: number
}

/**
 * Tiny in-process TTL cache with LRU eviction. Graph neighborhoods, universe views and search
 * results only change when ingestion runs, so short TTLs are safe and cheap.
 */
export class TtlCache<V> {
  private readonly map = new Map<string, Entry<V>>()

  constructor(
    private readonly ttlMs: number,
    private readonly max = 500,
  ) {}

  get(key: string): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key)
      return undefined
    }
    // refresh recency
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: string, value: V): V {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs })
    return value
  }

  async getOrSet(key: string, compute: () => Promise<V>): Promise<V> {
    const hit = this.get(key)
    if (hit !== undefined) return hit
    return this.set(key, await compute())
  }

  clear(): void {
    this.map.clear()
  }
}

const globalRef = globalThis as unknown as { __constellationCaches?: Map<string, TtlCache<unknown>> }

export function getCache<V>(name: string, ttlMs: number, max = 500): TtlCache<V> {
  if (!globalRef.__constellationCaches) globalRef.__constellationCaches = new Map()
  let cache = globalRef.__constellationCaches.get(name) as TtlCache<V> | undefined
  if (!cache) {
    cache = new TtlCache<V>(ttlMs, max)
    globalRef.__constellationCaches.set(name, cache as TtlCache<unknown>)
  }
  return cache
}
