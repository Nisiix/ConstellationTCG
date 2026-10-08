import { sql } from '@constellation/database'
import type { TCGTheme } from '@constellation/domain'
import { DEFAULT_THEME } from '@constellation/ui'
import { getDatabase } from '@/server/db'
import { CACHE_PUBLIC, errorResponse, json } from '@/server/http'
import { getRegistry } from '@/server/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface GameSummary {
  slug: string
  name: string
  publisher: string | null
  theme: TCGTheme
  /** Whether the catalog has been ingested for this game. */
  available: boolean
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result) return (result as { rows: T[] }).rows
  return []
}

/** Games known to the app: adapters (with their themes) merged with what the catalog contains. */
export async function GET() {
  try {
    const registry = getRegistry()
    let ingested = new Set<string>()
    try {
      const database = await getDatabase()
      const result = await database.db.execute(sql`select slug from tcg_games where active`)
      ingested = new Set(rows<{ slug: string }>(result).map((r) => r.slug))
    } catch {
      // the database may be empty or unavailable; adapters still describe their games
    }
    const games: GameSummary[] = registry.list().map((adapter) => {
      const def = adapter.definition()
      return {
        slug: def.slug,
        name: def.name,
        publisher: def.publisher,
        theme: def.theme ?? DEFAULT_THEME,
        available: ingested.has(def.slug),
      }
    })
    return json({ games }, { cache: CACHE_PUBLIC })
  } catch (error) {
    return errorResponse(error)
  }
}
