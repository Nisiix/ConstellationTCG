import { createPokemonAdapter, createPokemonFixtureAdapter } from '@constellation/adapter-pokemon'
import { AdapterRegistry } from '@constellation/adapters'
import type { WorkerEnv } from './env'

/**
 * Adapters available to the workers. Adding a TCG = registering its adapter here.
 * When `fixture` is set, adapters read committed fixtures instead of calling live sources.
 */
export function createRegistry(env: WorkerEnv, fixture: string | null): AdapterRegistry {
  const registry = new AdapterRegistry()
  registry.register(
    fixture
      ? createPokemonFixtureAdapter(fixture)
      : createPokemonAdapter({
          baseUrl: env.tcgdexBaseUrl,
          language: env.tcgdexLanguage,
          concurrency: env.tcgdexConcurrency,
          onRetry: (path, attempt) => console.warn(`retry ${attempt} for ${path}`),
        }),
  )
  return registry
}
