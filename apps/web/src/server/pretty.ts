import 'server-only'
import { sql, type Db } from '@constellation/database'
import { makeNodeId, slugify } from '@constellation/domain'
import { parseCardSlug } from '@/lib/pretty-url'

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result)
    return (result as { rows: T[] }).rows
  return []
}

/**
 * A printing from `/card/<game>/<slug>`: the source id (`base1-4`) wins, else
 * `<name>-<set slug>-<number>`; when several printings share set and number (languages), the one
 * whose name matches is preferred. Returns the node id or null.
 */
export async function resolveCardSlug(db: Db, game: string, slug: string): Promise<string | null> {
  const clean = slug.trim().toLowerCase()
  if (!clean) return null
  const byExternal = rows<{ id: string }>(
    await db.execute(sql`
      select p.id from card_printings p
      join tcg_sets s on s.id = p.set_id
      join tcg_games g on g.id = s.game_id
      where g.slug = ${game} and lower(p.external_id) = ${clean}
      limit 1
    `),
  )
  if (byExternal[0]) return makeNodeId('card_printing', byExternal[0].id)

  const sets = rows<{ id: string; slug: string }>(
    await db.execute(
      sql`select s.id, s.slug from tcg_sets s join tcg_games g on g.id = s.game_id where g.slug = ${game}`,
    ),
  )
  const parts = parseCardSlug(
    clean,
    sets.map((s) => s.slug),
  )
  if (!parts) return null
  const set = sets.find((s) => s.slug.toLowerCase() === parts.setSlug)
  if (!set) return null
  const matches = rows<{ id: string; name: string }>(
    await db.execute(sql`
      select p.id, i.canonical_name as name from card_printings p
      join card_identities i on i.id = p.identity_id
      where p.set_id = ${set.id} and (lower(p.collector_number) = ${parts.number} or lower(p.printed_number) = ${parts.number})
      order by p.language, p.external_id
      limit 20
    `),
  )
  if (matches.length === 0) return null
  const named = matches.find((m) => slugify(m.name) === parts.name) ?? matches[0]
  return named ? makeNodeId('card_printing', named.id) : null
}

/** A set from `/set/<game>/<slug>` by slug or source id. */
export async function resolveSetSlug(db: Db, game: string, slug: string): Promise<string | null> {
  const clean = slug.trim().toLowerCase()
  if (!clean) return null
  const found = rows<{ id: string }>(
    await db.execute(sql`
      select s.id from tcg_sets s join tcg_games g on g.id = s.game_id
      where g.slug = ${game} and (lower(s.slug) = ${clean} or lower(s.external_id) = ${clean})
      limit 1
    `),
  )
  return found[0] ? makeNodeId('set', found[0].id) : null
}
