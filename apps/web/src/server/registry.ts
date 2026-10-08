import 'server-only'
import { createPokemonAdapter } from '@constellation/adapter-pokemon'
import { AdapterRegistry } from '@constellation/adapters'
import { FilterService } from '@constellation/filters'
import { getDatabase } from './db'

const globalRef = globalThis as unknown as {
  __constellationRegistry?: AdapterRegistry
  __constellationFilters?: Promise<FilterService>
}

/**
 * Adapters known to the web app. Only their definitions and relationship rules are used here;
 * the app never calls external sources during user interaction.
 */
export function getRegistry(): AdapterRegistry {
  if (!globalRef.__constellationRegistry) {
    globalRef.__constellationRegistry = new AdapterRegistry().register(createPokemonAdapter())
  }
  return globalRef.__constellationRegistry
}

export function getFilterService(): Promise<FilterService> {
  if (!globalRef.__constellationFilters) {
    globalRef.__constellationFilters = getDatabase().then(
      (database) => new FilterService(database.db, getRegistry(), { ttlMs: 5 * 60_000 }),
    )
  }
  return globalRef.__constellationFilters
}

export const DEFAULT_GAME = 'pokemon'
