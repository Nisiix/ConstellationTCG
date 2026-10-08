import 'server-only'
import { getUniverse } from '@constellation/graph'
import { getCache } from './cache'
import { getDatabase } from './db'
import { DEFAULT_GAME, getFilterService } from './registry'

/**
 * Opens the database (the embedded PostgreSQL takes a moment to start) and fills the caches the
 * first visitor needs — the universe view and the filter definitions — as soon as the server
 * starts, instead of on the first request. Best effort: a failure is logged, never fatal.
 */
export async function warmUp(game = DEFAULT_GAME): Promise<void> {
  const started = Date.now()
  try {
    const database = await getDatabase()
    const universe = await getCache<Awaited<ReturnType<typeof getUniverse>>>('universe', 120_000, 20).getOrSet(game, () =>
      getUniverse(database.db, game),
    )
    const filters = await getFilterService()
    await filters.definitions(game)
    console.log(
      `warm-up: ${game} ready in ${Date.now() - started}ms` + (universe ? ` (${universe.nodes.length} universe points)` : ' (no catalog yet)'),
    )
  } catch (error) {
    console.warn('warm-up skipped:', error instanceof Error ? error.message : error)
  }
}
