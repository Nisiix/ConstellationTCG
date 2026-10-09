/**
 * Supabase Edge Function `catalog-import` (Deno).
 *
 * Called by pg_cron through pg_net every few seconds while there is work: each call runs one job
 * of the catalog import (see packages/catalog-import). The database connection string is the
 * platform's own `SUPABASE_DB_URL`, so no password is configured anywhere by hand; the shared
 * token that authenticates the caller is generated inside the database (Vault) and read back here.
 *
 * This file is the source; `pnpm functions:build` bundles it with esbuild into `../index.ts`,
 * which is what gets deployed (npm packages stay external as `npm:` specifiers).
 */
import { createPokemonAdapter } from '@constellation/adapter-pokemon'
import { AdapterRegistry } from '@constellation/adapters'
import { handleCatalogImportRequest } from '@constellation/catalog-import'
import { createPostgresDatabase, rowsOf, sql, type Database } from '@constellation/database'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

/**
 * The platform retires a worker after 150 s of wall clock, whatever it is doing. Past this age a
 * worker answers "not accepting work" so that no job dies halfway; the next tick lands on a fresh
 * worker.
 */
const MAX_WORKER_AGE_MS = Number(Deno.env.get('CATALOG_IMPORT_MAX_WORKER_AGE_MS') ?? 90_000)
const WORKER_STARTED_AT = Date.now()

const TCGDEX_BASE_URL = Deno.env.get('TCGDEX_BASE_URL')?.trim() || 'https://api.tcgdex.net/v2'

const registry = new AdapterRegistry().register(
  createPokemonAdapter({
    baseUrl: TCGDEX_BASE_URL,
    language: Deno.env.get('TCGDEX_LANGUAGE')?.trim() || 'en',
    concurrency: Number(Deno.env.get('TCGDEX_CONCURRENCY') ?? 6) || 6,
    onRetry: (path, attempt) => console.warn(`retry ${attempt} for ${path}`),
  }),
)

let databasePromise: Promise<Database> | null = null
function database(): Promise<Database> {
  if (!databasePromise) {
    const url = Deno.env.get('SUPABASE_DB_URL')
    if (!url) throw new Error('SUPABASE_DB_URL is not set')
    databasePromise = createPostgresDatabase(url, { maxConnections: 3 })
  }
  return databasePromise
}

async function readToken(db: Database): Promise<string | null> {
  const rows = rowsOf<{ secret: string | null }>(
    await db.db.execute(sql`select decrypted_secret as secret from vault.decrypted_secrets where name = 'catalog_import_token'`),
  )
  return rows[0]?.secret ?? null
}

Deno.serve(async (request) => {
  try {
    const db = await database()
    return await handleCatalogImportRequest(request, {
      database: db,
      registry,
      source: { name: 'tcgdex', type: 'api', baseUrl: TCGDEX_BASE_URL },
      token: () => readToken(db),
      acceptWork: () => Date.now() - WORKER_STARTED_AT < MAX_WORKER_AGE_MS,
      log: (message) => console.log(message),
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
