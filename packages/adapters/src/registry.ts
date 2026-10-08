import type { TCGAdapter } from '@constellation/domain'

/**
 * Registry of TCG adapters, keyed by `definition().adapterKey`.
 *
 * The core never imports a concrete adapter: applications and workers build a registry and hand it
 * to the services that need one. Adding a TCG means registering one more adapter here.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, TCGAdapter>()

  register(adapter: TCGAdapter): this {
    const key = adapter.definition().adapterKey
    if (this.adapters.has(key)) {
      throw new Error(`Adapter "${key}" is already registered`)
    }
    this.adapters.set(key, adapter)
    return this
  }

  get(key: string): TCGAdapter {
    const adapter = this.adapters.get(key)
    if (!adapter) throw new Error(`No adapter registered for "${key}"`)
    return adapter
  }

  has(key: string): boolean {
    return this.adapters.has(key)
  }

  list(): TCGAdapter[] {
    return [...this.adapters.values()]
  }

  /** Resolve an adapter by game slug (adapter keys default to the game slug). */
  bySlug(slug: string): TCGAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.definition().slug === slug) return adapter
    }
    return null
  }
}
