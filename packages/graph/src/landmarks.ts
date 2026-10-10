/**
 * Landmarks: the points of a game's sky worth knowing first, each with the reason it stands out.
 *
 * All of them are read from the relationships, never from card statistics or prices:
 *   - eras: the set that opened each series (newest first);
 *   - crossroads: the expansions with the most bridges to other expansions;
 *   - most printed: the cards printed in the most expansions (not the basic energies, in every set);
 *   - recurring subjects: what the cards show (Pokémon) in the most expansions;
 *   - artists across eras: the artists whose work spans the most series.
 *
 * TCG agnostic: subjects are whatever node type the adapter projects (any point that is not a
 * card, an expansion, the game or an artist).
 */
import { sql, type Db } from '@constellation/database'
import type { GraphNode } from '@constellation/domain'
import { loadNodes } from './neighborhood'
import { rows } from './rows'

/** Landmarks per category. */
export const LANDMARKS_PER_CATEGORY = 6

export type LandmarkCategoryId = 'eras' | 'crossroads' | 'most-printed' | 'subjects' | 'artists'

export interface Landmark {
  node: GraphNode
  /** The measure it stands out by (sets, series, bridges…). */
  value: number
  /** One sentence: why it is a landmark. */
  reason: string
}

export interface LandmarkCategory {
  id: LandmarkCategoryId
  title: string
  description: string
  /** The relationship whose color the category wears in the sky and in the lists. */
  relationshipType: string
  items: Landmark[]
}

export interface Landmarks {
  game: GraphNode
  categories: LandmarkCategory[]
}

interface Ranked {
  id: string
  value: number | string
  first?: string | null
  last?: string | null
  extra?: string | null
}

const CORE_TYPES = ['game', 'series', 'set', 'card_identity', 'card_printing', 'artist', 'digital_asset']

function years(first: string | null | undefined, last: string | null | undefined): string {
  const a = first?.slice(0, 4)
  const b = last?.slice(0, 4)
  if (!a) return ''
  return !b || a === b ? ` in ${a}` : `, ${a}–${b}`
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`
}

export async function getLandmarks(db: Db, gameSlug: string, perCategory = LANDMARKS_PER_CATEGORY): Promise<Landmarks | null> {
  const limit = Math.max(1, Math.min(20, Math.floor(perCategory)))
  const gameRow = rows<{ id: string }>(
    await db.execute(sql`
      select n.id from graph_nodes n join tcg_games g on g.id = n.game_id
      where g.slug = ${gameSlug} and n.node_type = 'game' limit 1
    `),
  )[0]
  if (!gameRow) return null
  const gameNodeId = gameRow.id
  const inGame = sql`n.game_id = (select game_id from graph_nodes where id = ${gameNodeId})`

  // The set that opened each series: the earliest of its sets.
  const eras = rows<Ranked>(
    await db.execute(sql`
      select distinct on (e.target_node_id) e.source_node_id as id, 0 as value, s.label as extra,
        n.metadata->>'releaseDate' as first
      from graph_edges e
      join graph_nodes n on n.id = e.source_node_id and n.node_type = 'set'
      join graph_nodes s on s.id = e.target_node_id and s.node_type = 'series'
      where e.relationship_type = 'PART_OF' and ${inGame}
      order by e.target_node_id, coalesce(n.metadata->>'releaseDate', '9999'), n.label
    `),
  )
    .sort((a, b) => String(b.first ?? '').localeCompare(String(a.first ?? '')))
    .slice(0, limit)

  // Expansions with the most bridges (the same subjects, the same artists, a similar make-up).
  const crossroads = rows<Ranked>(
    await db.execute(sql`
      select id, count(distinct other)::int as value from (
        select e.source_node_id as id, e.target_node_id as other from graph_edges e
          join graph_nodes n on n.id = e.source_node_id
          where e.relationship_type in ('SHARED_SUBJECTS', 'SHARED_ARTISTS', 'SIMILAR_STRUCTURE') and ${inGame}
        union all
        select e.target_node_id as id, e.source_node_id as other from graph_edges e
          join graph_nodes n on n.id = e.target_node_id
          where e.relationship_type in ('SHARED_SUBJECTS', 'SHARED_ARTISTS', 'SIMILAR_STRUCTURE') and ${inGame}
      ) b
      group by id order by value desc, id limit ${limit}
    `),
  )

  // Cards printed in the most expansions.
  const mostPrinted = rows<Ranked>(
    await db.execute(sql`
      select pi.target_node_id as id, count(distinct bs.target_node_id)::int as value,
        min(p.metadata->>'releaseDate') as first, max(p.metadata->>'releaseDate') as last
      from graph_edges pi
      join graph_nodes p on p.id = pi.source_node_id
      join graph_nodes n on n.id = pi.target_node_id
      join graph_edges bs on bs.source_node_id = pi.source_node_id and bs.relationship_type = 'BELONGS_TO'
      where pi.relationship_type = 'PRINTING_OF' and ${inGame}
        and coalesce(n.metadata->>'entityType', '') <> 'energy'
      group by pi.target_node_id
      having count(distinct bs.target_node_id) > 1
      order by value desc, id limit ${limit}
    `),
  )

  // What the cards show, in the most expansions.
  const subjects = rows<Ranked>(
    await db.execute(sql`
      select e.target_node_id as id, count(distinct bs.target_node_id)::int as value,
        min(p.metadata->>'releaseDate') as first, max(p.metadata->>'releaseDate') as last
      from graph_edges e
      join graph_nodes p on p.id = e.source_node_id and p.node_type = 'card_printing'
      join graph_nodes n on n.id = e.target_node_id
      join graph_edges bs on bs.source_node_id = e.source_node_id and bs.relationship_type = 'BELONGS_TO'
      where n.node_type not in (${sql.join(CORE_TYPES.map((t) => sql`${t}`), sql`, `)}) and ${inGame}
      group by e.target_node_id
      order by value desc, id limit ${limit}
    `),
  )

  // Artists whose work spans the most series (then the most expansions).
  const artists = rows<Ranked & { sets: number | string }>(
    await db.execute(sql`
      select ia.target_node_id as id, count(distinct po.target_node_id)::int as value,
        count(distinct bs.target_node_id)::int as sets,
        min(p.metadata->>'releaseDate') as first, max(p.metadata->>'releaseDate') as last
      from graph_edges ia
      join graph_nodes p on p.id = ia.source_node_id
      join graph_nodes n on n.id = ia.target_node_id and n.node_type = 'artist'
      join graph_edges bs on bs.source_node_id = ia.source_node_id and bs.relationship_type = 'BELONGS_TO'
      left join graph_edges po on po.source_node_id = bs.target_node_id and po.relationship_type = 'PART_OF'
      where ia.relationship_type = 'ILLUSTRATED_BY' and ${inGame}
      group by ia.target_node_id
      order by value desc, sets desc, id limit ${limit}
    `),
  )

  const ids = [gameNodeId, ...eras, ...crossroads, ...mostPrinted, ...subjects, ...artists].map((r) => (typeof r === 'string' ? r : r.id))
  const nodes = await loadNodes(db, [...new Set(ids)])
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const game = byId.get(gameNodeId)
  if (!game) return null

  const items = (ranked: Ranked[], reason: (r: Ranked, value: number) => string): Landmark[] =>
    ranked
      .map((r) => {
        const node = byId.get(r.id)
        const value = Number(r.value)
        return node ? { node, value, reason: reason(r, value) } : null
      })
      .filter((l): l is Landmark => l !== null)

  const categories: LandmarkCategory[] = [
    {
      id: 'eras',
      title: 'Where each era began',
      description: 'The first expansion of every series, newest first.',
      relationshipType: 'PART_OF',
      items: items(eras, (r) => `Opened ${r.extra ?? 'its series'}${years(r.first, null)}`),
    },
    {
      id: 'crossroads',
      title: 'Crossroads',
      description: 'Expansions with the most bridges to others: the same Pokémon, the same artists, a similar make-up.',
      relationshipType: 'SHARED_SUBJECTS',
      items: items(crossroads, (_, v) => `Bridged to ${plural(v, 'other expansion')}`),
    },
    {
      id: 'most-printed',
      title: 'Printed again and again',
      description: 'The cards printed in the most expansions (energies aside).',
      relationshipType: 'REPRINT_OF',
      items: items(mostPrinted, (r, v) => `Printed in ${plural(v, 'expansion')}${years(r.first, r.last)}`),
    },
    {
      id: 'subjects',
      title: 'Always returning',
      description: 'What the cards show in the most expansions.',
      relationshipType: 'SAME_POKEMON',
      items: items(subjects, (r, v) => `On cards in ${plural(v, 'expansion')}${years(r.first, r.last)}`),
    },
    {
      id: 'artists',
      title: 'Artists across eras',
      description: 'The artists whose work spans the most series.',
      relationshipType: 'ILLUSTRATED_BY',
      items: items(artists, (r, v) => {
        const sets = Number((r as Ranked & { sets?: number | string }).sets ?? 0)
        return `Drew for ${plural(v, 'series', 'series')} and ${plural(sets, 'expansion')}${years(r.first, r.last)}`
      }),
    },
  ]
  return { game, categories: categories.filter((c) => c.items.length > 0) }
}
