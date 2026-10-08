/**
 * Minimal SQL migrator.
 *
 * Applies every `*.sql` file in `supabase/migrations/` (sorted by name) that has not been recorded
 * in `schema_migrations`. The same files can be applied by the Supabase CLI, so local embedded
 * databases and hosted projects share one migration history.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import type { Database } from './client'

export interface MigrationFile {
  name: string
  path: string
}

export interface MigrationResult {
  applied: string[]
  skipped: string[]
}

/** Default location: `<repo>/supabase/migrations`, resolved relative to this package. */
export function defaultMigrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '../../../supabase/migrations')
}

export async function listMigrationFiles(dir = defaultMigrationsDir()): Promise<MigrationFile[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function runMigrations(
  database: Database,
  options: { dir?: string; log?: (message: string) => void } = {},
): Promise<MigrationResult> {
  const log = options.log ?? (() => {})
  await database.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `)
  const appliedRows = await database.db.execute<{ name: string }>(
    sql`select name from schema_migrations`,
  )
  const applied = new Set(rowsOf<{ name: string }>(appliedRows).map((r) => r.name))
  const result: MigrationResult = { applied: [], skipped: [] }

  for (const file of await listMigrationFiles(options.dir)) {
    if (applied.has(file.name)) {
      result.skipped.push(file.name)
      continue
    }
    log(`applying ${file.name}`)
    const content = await readFile(file.path, 'utf8')
    await database.exec(content)
    await database.db.execute(sql`insert into schema_migrations (name) values (${file.name})`)
    result.applied.push(file.name)
  }
  return result
}

/** Drizzle's `execute` returns driver-specific shapes; normalise to an array of rows. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows
  }
  return []
}
