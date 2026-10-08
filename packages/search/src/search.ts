/**
 * Search over graph nodes.
 *
 * One query, four match kinds ranked in this order:
 *   exact      — the normalized label equals the query
 *   prefix     — the label starts with the query ("char" → Charizard, Charmeleon, Charmander)
 *   word       — a later word starts with the query ("set" → Base Set)
 *   fuzzy      — trigram similarity (pg_trgm) for typos ("charizrd")
 *
 * Node types are weighted so that semantic hubs (identities, sets, Pokémon, artists) rank above
 * individual printings, and printings are capped so one popular card cannot flood the results.
 */
import { sql, type Db } from '@constellation/database'
import { normalizeName, type NodeType, type SearchResult } from '@constellation/domain'

export interface SearchOptions {
  q: string
  /** Game slug. */
  game?: string | null
  types?: NodeType[] | null
  limit?: number
  /** Maximum card_printing results unless printings are the only requested type. */
  printingCap?: number
}

export interface SearchHit extends SearchResult {
  match: 'exact' | 'prefix' | 'word' | 'fuzzy'
}

const TYPE_PRIORITY: Record<NodeType, number> = {
  card_identity: 0,
  set: 1,
  series: 2,
  pokemon: 3,
  artist: 4,
  card_printing: 5,
  game: 6,
  mechanic: 7,
  attribute: 8,
  digital_asset: 9,
}

interface Row {
  id: string
  node_type: NodeType
  label: string
  subtitle: string | null
  image_url: string | null
  search_text: string
  score: number | string
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`)
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result) return (result as { rows: T[] }).rows
  return []
}

export async function search(db: Db, options: SearchOptions): Promise<SearchHit[]> {
  const q = normalizeName(options.q)
  if (!q) return []
  const limit = Math.min(100, Math.max(1, options.limit ?? 20))
  const like = escapeLike(q)
  const prefix = `${like}%`
  const word = `% ${like}%`
  const types = options.types?.length ? options.types : null
  const typeFilter = types
    ? sql`and n.node_type in (${sql.join(
        types.map((t) => sql`${t}`),
        sql`, `,
      )})`
    : sql``
  const gameFilter = options.game ? sql`and g.slug = ${options.game}` : sql``
  // Short queries cannot be matched by trigrams reliably; rely on prefix matching only.
  const fuzzy = q.length >= 3 ? sql`or n.search_text % ${q}` : sql``

  const result = await db.execute(sql`
    select n.id, n.node_type, n.label, n.subtitle, n.image_url, n.search_text,
      case
        when n.search_text = ${q} or lower(n.label) = ${q} then 1.0
        when n.search_text like ${prefix} then 0.9
        when n.search_text like ${word} then 0.8
        else similarity(n.search_text, ${q})
      end as score
    from graph_nodes n
    join tcg_games g on g.id = n.game_id
    where true ${gameFilter} ${typeFilter}
      and (n.search_text like ${prefix} or n.search_text like ${word} ${fuzzy})
    order by score desc, length(n.label) asc, n.label asc
    limit ${Math.max(limit * 5, 60)}
  `)

  const hits = rows<Row>(result).map((r): SearchHit => {
    const score = Number(r.score)
    const match: SearchHit['match'] =
      score >= 1 ? 'exact' : score >= 0.9 ? 'prefix' : score >= 0.8 ? 'word' : 'fuzzy'
    return {
      nodeId: r.id,
      type: r.node_type,
      title: r.label,
      subtitle: r.subtitle ?? undefined,
      image: r.image_url ?? undefined,
      score: Math.round(score * 1000) / 1000,
      match,
    }
  })

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type] ||
      a.title.length - b.title.length ||
      a.title.localeCompare(b.title),
  )

  const printingsOnly = types?.length === 1 && types[0] === 'card_printing'
  const cap = printingsOnly ? Infinity : (options.printingCap ?? 6)
  let printings = 0
  const out: SearchHit[] = []
  for (const hit of hits) {
    if (hit.type === 'card_printing') {
      if (printings >= cap) continue
      printings += 1
    }
    out.push(hit)
    if (out.length >= limit) break
  }
  return out
}
