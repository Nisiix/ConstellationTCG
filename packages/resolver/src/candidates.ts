/**
 * Candidate printings for an asset, from the canonical catalog. The search is deliberately wide
 * (every printing whose identity name resembles the asset's name, in the asset's game); the
 * scorer narrows it down.
 */
import { sql, type Db } from '@constellation/database'
import { normalizeName, type AssetMatchSignals } from '@constellation/domain'
import type { PrintingCandidate } from './score'

interface Row {
  printing_id: string
  identity_name: string
  set_name: string
  set_slug: string
  set_external_id: string
  collector_number: string
  printed_number: string | null
  language: string
  variant: string
  finish: string
  artist_name: string | null
  external_id: string
  source_name: string
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result) return (result as { rows: T[] }).rows
  return []
}

export async function findCandidates(db: Db, signals: AssetMatchSignals, limit = 200): Promise<PrintingCandidate[]> {
  const name = signals.name ? normalizeName(signals.name) : ''
  const externalIds = Object.values(signals.externalIds ?? {})
  if (!name && externalIds.length === 0) return []
  const gameFilter = signals.game ? sql`and g.slug = ${signals.game}` : sql``
  // Name match on the identity (a word of the asset's name is enough to be a candidate) or an
  // external id match on the printing.
  const nameFilter = name
    ? sql`i.normalized_name = ${name} or ${name} like '%' || i.normalized_name || '%' or i.normalized_name like '%' || ${name} || '%'`
    : sql`false`
  const idFilter = externalIds.length
    ? sql`or p.external_id in (${sql.join(
        externalIds.map((id) => sql`${id}`),
        sql`, `,
      )})`
    : sql``
  const result = await db.execute(sql`
    select p.id as printing_id, i.canonical_name as identity_name, s.name as set_name, s.slug as set_slug,
      s.external_id as set_external_id, p.collector_number, p.printed_number, p.language, p.variant, p.finish,
      a.name as artist_name, p.external_id, src.name as source_name
    from card_printings p
    join card_identities i on i.id = p.identity_id
    join tcg_sets s on s.id = p.set_id
    join tcg_games g on g.id = s.game_id
    join tcg_sources src on src.id = p.source_id
    left join artists a on a.id = p.artist_id
    where (${nameFilter} ${idFilter}) ${gameFilter}
    limit ${limit}
  `)
  return rows<Row>(result).map((r) => ({
    printingId: r.printing_id,
    identityName: r.identity_name,
    setName: r.set_name,
    setSlug: r.set_slug,
    setExternalId: r.set_external_id,
    collectorNumber: r.collector_number,
    printedNumber: r.printed_number,
    language: r.language,
    variant: r.variant,
    finish: r.finish,
    artistName: r.artist_name,
    externalIds: { [r.source_name]: r.external_id },
  }))
}
