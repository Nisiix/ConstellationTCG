/**
 * Database client.
 *
 * Two drivers behind one interface:
 *  - `pglite`   — embedded PostgreSQL (WASM) persisted in a directory, or in memory for tests.
 *  - `postgres` — a real PostgreSQL / Supabase server via `DATABASE_URL`.
 *
 * Both expose the same Drizzle `db` handle, so every package above this one is driver-agnostic.
 */
import { DatabaseError } from '@constellation/domain'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { schema } from './schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export type DatabaseDriver = 'pglite' | 'postgres'

export interface Database {
  readonly driver: DatabaseDriver
  readonly db: Db
  /** Execute raw SQL that may contain several statements (migrations). */
  exec(sqlText: string): Promise<void>
  close(): Promise<void>
}

export interface DatabaseOptions {
  /** PostgreSQL connection string. When set, the `postgres` driver is used. */
  url?: string | null
  /** Directory for the embedded database. `undefined`/`:memory:` means in-memory. */
  pgliteDataDir?: string | null
  /** Connection pool size for the `postgres` driver. */
  maxConnections?: number
}

export async function createDatabase(options: DatabaseOptions = {}): Promise<Database> {
  const url = options.url ?? process.env.DATABASE_URL ?? ''
  if (url.trim()) return createPostgresDatabase(url.trim(), options)
  const dir = options.pgliteDataDir ?? process.env.PGLITE_DATA_DIR ?? null
  return createPgliteDatabase(dir)
}

export async function createPgliteDatabase(dataDir: string | null): Promise<Database> {
  const [{ PGlite }, { pg_trgm }, { drizzle }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('@electric-sql/pglite/contrib/pg_trgm'),
    import('drizzle-orm/pglite'),
  ])
  const memory = !dataDir || dataDir === ':memory:'
  const client = memory
    ? new PGlite({ extensions: { pg_trgm } })
    : new PGlite(dataDir, { extensions: { pg_trgm } })
  await client.waitReady
  const db = drizzle(client, { schema }) as unknown as Db
  return {
    driver: 'pglite',
    db,
    async exec(sqlText) {
      try {
        await client.exec(sqlText)
      } catch (error) {
        throw new DatabaseError('Failed to execute SQL', { driver: 'pglite' }, { cause: error })
      }
    },
    async close() {
      await client.close()
    },
  }
}

export async function createPostgresDatabase(
  url: string,
  options: DatabaseOptions = {},
): Promise<Database> {
  const [{ default: postgres }, { drizzle }] = await Promise.all([
    import('postgres'),
    import('drizzle-orm/postgres-js'),
  ])
  const client = postgres(url, {
    max: options.maxConnections ?? 10,
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    onnotice: () => {},
  })
  const db = drizzle(client, { schema }) as unknown as Db
  return {
    driver: 'postgres',
    db,
    async exec(sqlText) {
      try {
        await client.unsafe(sqlText)
      } catch (error) {
        throw new DatabaseError('Failed to execute SQL', { driver: 'postgres' }, { cause: error })
      }
    },
    async close() {
      await client.end({ timeout: 5 })
    },
  }
}
