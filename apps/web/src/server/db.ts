import 'server-only'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createDatabase, runMigrations, type Database } from '@constellation/database'

/** Walk up from cwd until the workspace root (pnpm-workspace.yaml) is found. */
export function repoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

function loadRootEnv(): void {
  const file = path.join(repoRoot(), '.env')
  if (!existsSync(file)) return
  try {
    process.loadEnvFile(file)
  } catch {
    // ignore
  }
}

const globalRef = globalThis as unknown as { __constellationDb?: Promise<Database> }

async function open(): Promise<Database> {
  loadRootEnv()
  const root = repoRoot()
  const dataDir = process.env.PGLITE_DATA_DIR?.trim() || '.data/pglite'
  const database = await createDatabase({
    url: process.env.DATABASE_URL,
    pgliteDataDir: path.isAbsolute(dataDir) ? dataDir : path.join(root, dataDir),
  })
  await runMigrations(database, { dir: path.join(root, 'supabase/migrations') })
  return database
}

/** Process-wide database handle (survives HMR in development). */
export function getDatabase(): Promise<Database> {
  if (!globalRef.__constellationDb) {
    globalRef.__constellationDb = open().catch((error) => {
      globalRef.__constellationDb = undefined
      throw error
    })
  }
  return globalRef.__constellationDb
}
