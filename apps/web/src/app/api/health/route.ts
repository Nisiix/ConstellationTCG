import { sql } from '@constellation/database'
import { getGraphStats } from '@constellation/graph'
import type { SourceHealth } from '@constellation/domain'
import { getDatabase } from '@/server/db'
import { errorResponse, json } from '@/server/http'
import { getProviderRegistry } from '@/server/ownership'
import { supabaseConfig } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SourceRow {
  name: string
  game: string
  last_sync_at: string | null
  last_status: string | null
  last_failed: number | string | null
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result)
    return (result as { rows: T[] }).rows
  return []
}

function healthOf(row: SourceRow): SourceHealth {
  if (!row.last_sync_at) return 'unknown'
  if (row.last_status === 'failed') return 'failed'
  if (row.last_status === 'partial' || Number(row.last_failed ?? 0) > 0) return 'degraded'
  const ageMs = Date.now() - new Date(row.last_sync_at).getTime()
  return ageMs < 14 * 24 * 3600 * 1000 ? 'healthy' : 'degraded'
}

export async function GET() {
  try {
    const database = await getDatabase()
    const sources = rows<SourceRow>(
      await database.db.execute(sql`
        select s.name, g.slug as game, s.last_sync_at,
          (select r.status from ingestion_runs r where r.source_id = s.id order by r.started_at desc limit 1) as last_status,
          (select r.records_failed from ingestion_runs r where r.source_id = s.id order by r.started_at desc limit 1) as last_failed
        from tcg_sources s join tcg_games g on g.id = s.game_id
        order by g.slug, s.priority
      `),
    )
    const graph = await getGraphStats(database.db)
    return json({
      ok: true,
      driver: database.driver,
      sources: sources.map((s) => ({
        name: s.name,
        game: s.game,
        lastSyncAt: s.last_sync_at,
        health: healthOf(s),
      })),
      graph,
      // My Constellation: whether accounts work here and which ownership providers are usable.
      accounts: {
        configured: supabaseConfig() !== null,
        providers: getProviderRegistry()
          .list()
          .map((p) => ({ id: p.id, available: p.availability.available })),
      },
      time: new Date().toISOString(),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
