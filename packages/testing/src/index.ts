import { createPokemonFixtureAdapter } from '@constellation/adapter-pokemon'
import { AdapterRegistry } from '@constellation/adapters'
import { createPgliteDatabase, runMigrations, type Database } from '@constellation/database'
import { runIngestion, type IngestionReport } from '@constellation/ingestion'

export const FIXTURE_SOURCE = {
  name: 'tcgdex',
  type: 'api' as const,
  baseUrl: 'https://api.tcgdex.net/v2',
}

/** Fresh in-memory PostgreSQL with all migrations applied. */
export async function createTestDatabase(): Promise<Database> {
  const database = await createPgliteDatabase(':memory:')
  await runMigrations(database)
  return database
}

/** Registry with the Pokémon adapter backed by the committed Base Set fixture. */
export function createFixtureRegistry(fixture = 'base1'): AdapterRegistry {
  return new AdapterRegistry().register(createPokemonFixtureAdapter(fixture))
}

/** Ingest the Base Set fixture into a database (offline). */
export async function ingestFixture(
  database: Database,
  fixture = 'base1',
): Promise<IngestionReport> {
  return runIngestion({
    database,
    adapter: createPokemonFixtureAdapter(fixture),
    mode: 'fixture',
    source: FIXTURE_SOURCE,
  })
}

/** Database + fixture in one call, for graph/search/filter tests. */
export async function createSeededDatabase(fixture = 'base1'): Promise<{
  database: Database
  registry: AdapterRegistry
  report: IngestionReport
}> {
  const database = await createTestDatabase()
  const report = await ingestFixture(database, fixture)
  return { database, registry: createFixtureRegistry(fixture), report }
}
