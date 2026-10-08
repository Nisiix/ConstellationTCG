import 'server-only'
import { FilterService } from '@constellation/filters'
import { getRegistry } from './adapters'
import { getDatabase } from './db'

export { DEFAULT_GAME, getRegistry } from './adapters'

const globalRef = globalThis as unknown as { __constellationFilters?: Promise<FilterService> }

export function getFilterService(): Promise<FilterService> {
  if (!globalRef.__constellationFilters) {
    globalRef.__constellationFilters = getDatabase().then(
      (database) => new FilterService(database.db, getRegistry(), { ttlMs: 5 * 60_000 }),
    )
  }
  return globalRef.__constellationFilters
}
