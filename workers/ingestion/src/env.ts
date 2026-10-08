import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repository root (this file lives in workers/ingestion/src). */
export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
}

/**
 * Load `.env` from the repository root into process.env (existing variables win).
 * Uses Node's built-in loader; no dependency needed.
 */
export function loadEnv(): void {
  const file = path.join(repoRoot(), '.env')
  if (!existsSync(file)) return
  try {
    process.loadEnvFile(file)
  } catch {
    // ignore: a malformed .env should not break the worker
  }
}

export interface WorkerEnv {
  databaseUrl: string | null
  pgliteDataDir: string
  tcgdexBaseUrl: string | undefined
  tcgdexLanguage: string
  tcgdexConcurrency: number
}

export function readEnv(): WorkerEnv {
  const dataDir = process.env.PGLITE_DATA_DIR?.trim() || '.data/pglite'
  return {
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDataDir: path.isAbsolute(dataDir) ? dataDir : path.join(repoRoot(), dataDir),
    tcgdexBaseUrl: process.env.TCGDEX_BASE_URL?.trim() || undefined,
    tcgdexLanguage: process.env.TCGDEX_LANGUAGE?.trim() || 'en',
    tcgdexConcurrency: Number(process.env.TCGDEX_CONCURRENCY ?? 6) || 6,
  }
}
