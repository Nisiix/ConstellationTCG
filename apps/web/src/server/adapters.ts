import 'server-only'
import { createPokemonAdapter } from '@constellation/adapter-pokemon'
import { AdapterRegistry } from '@constellation/adapters'

const globalRef = globalThis as unknown as { __constellationRegistry?: AdapterRegistry }

/**
 * Adapters known to the web app. Only their definitions (theme, filters, placeholder images)
 * and relationship rules are used here; the app never calls external sources during user
 * interaction. Kept apart from the database so static pages (the landing) can list games
 * without touching it.
 */
export function getRegistry(): AdapterRegistry {
  if (!globalRef.__constellationRegistry) {
    globalRef.__constellationRegistry = new AdapterRegistry().register(createPokemonAdapter())
  }
  return globalRef.__constellationRegistry
}

export const DEFAULT_GAME = 'pokemon'
