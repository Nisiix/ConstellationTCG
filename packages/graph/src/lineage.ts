/**
 * Lineage: the life of one subject (Pokémon: a species) through the catalog, in time.
 *
 * From any of its points (the species, a card that shows it, one of its printings) it gathers:
 *   - the family: the subjects of its evolution line, from the identity-level `EVOLUTION_OF`
 *     edges (pre-evolutions and evolutions, a few steps each way), each with its stage;
 *   - every printing that shows it, oldest first, with its set and series (the eras);
 *   - the artists who drew it, with the span of years they did;
 *   - the real edges among all of them (set → series, printing → set, printing → artist, reprints).
 *
 * TCG agnostic: the subject relation is the adapter's (`subjectRelation`); a card without a
 * subject (a Trainer) has its own lineage through `PRINTING_OF`, the printings of the card itself.
 */
import { sql, type Db } from '@constellation/database'
import { GraphError, parseNodeId, type GraphEdge, type GraphNode } from '@constellation/domain'
import { loadNodes } from './neighborhood'
import { rows, toGraphEdge, type EdgeRow } from './rows'

/** Printings returned at most (a species like Pikachu has hundreds; the oldest come first). */
export const LINEAGE_PRINTING_LIMIT = 400
/** Evolution steps followed each way from the subject. */
const FAMILY_DEPTH = 3
/** Family members kept (Eevee has many evolutions). */
const FAMILY_LIMIT = 16

export interface LineageMember {
  node: GraphNode
  /** 0 for the base of the line, 1 for its first evolution, … */
  stage: number
  /** The subjects this one evolves from (ids of other members). */
  evolvesFrom: string[]
}

export interface LineageSet {
  set: GraphNode
  /** The printings of the subject in this set, by collector number. */
  printings: GraphNode[]
  /** The year of the set (or of its first printing), when known. */
  year: number | null
}

export interface LineageEra {
  series: GraphNode | null
  /** Sets of this era showing the subject, newest first. */
  sets: LineageSet[]
}

export interface LineageArtist {
  node: GraphNode
  count: number
  firstYear: number | null
  lastYear: number | null
}

export interface Lineage {
  /** The point the lineage was asked from. */
  from: GraphNode
  /** Whose lineage it is: a subject (a Pokémon) or, for a card without one, the card itself. */
  subject: GraphNode
  /** The evolution line, base first (empty when the subject has none). */
  family: LineageMember[]
  /** Every printing (up to the limit), oldest first. */
  printings: GraphNode[]
  /** Eras, newest first (expansions newest first, as everywhere). */
  eras: LineageEra[]
  /** Most prolific first. */
  artists: LineageArtist[]
  first: GraphNode | null
  latest: GraphNode | null
  /** How many printings show the subject in all (the list may be capped). */
  printingCount: number
  setCount: number
  truncated: boolean
  /** Real edges among the points above, plus the family's evolution edges. */
  edges: GraphEdge[]
}

function list(values: readonly string[]) {
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )
}

export function yearOf(value: unknown): number | null {
  if (typeof value !== 'string' || value.length < 4) return null
  const year = Number(value.slice(0, 4))
  return Number.isInteger(year) && year > 0 && year < 9999 ? year : null
}

function release(node: GraphNode): string {
  const m = node.metadata
  const value = m.releaseDate ?? m.firstReleaseDate
  return typeof value === 'string' ? value : '9999'
}

function byNumber(a: GraphNode, b: GraphNode): number {
  const x = String(a.metadata.collectorNumber ?? '')
  const y = String(b.metadata.collectorNumber ?? '')
  return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0) || a.id.localeCompare(b.id)
}

/** The subject a card shows: the most common target of the subject relation among its printings. */
async function subjectOfPrintings(db: Db, printingIds: string[], relation: string): Promise<string | null> {
  if (printingIds.length === 0) return null
  const result = rows<{ id: string; n: number | string }>(
    await db.execute(sql`
      select target_node_id as id, count(*)::int as n from graph_edges
      where relationship_type = ${relation} and source_node_id in (${list(printingIds)})
      group by target_node_id order by n desc, target_node_id limit 1
    `),
  )
  return result[0]?.id ?? null
}

async function printingsOfIdentity(db: Db, identityIds: string[]): Promise<string[]> {
  if (identityIds.length === 0) return []
  return rows<{ id: string }>(
    await db.execute(sql`
      select source_node_id as id from graph_edges
      where relationship_type = 'PRINTING_OF' and target_node_id in (${list(identityIds)})
    `),
  ).map((r) => r.id)
}

/** Whose lineage a point opens: the subject itself, a card's subject, or the card itself. */
async function resolveSubject(db: Db, from: GraphNode, relation: string | null): Promise<{ subject: string; kind: 'entity' | 'identity' }> {
  if (from.nodeType === 'card_printing') {
    const subject = relation ? await subjectOfPrintings(db, [from.id], relation) : null
    if (subject) return { subject, kind: 'entity' }
    const identity = rows<{ id: string }>(
      await db.execute(sql`select target_node_id as id from graph_edges where relationship_type = 'PRINTING_OF' and source_node_id = ${from.id} limit 1`),
    )[0]?.id
    if (!identity) throw new GraphError(`No lineage for ${from.id}`, { nodeId: from.id, status: 404 })
    return { subject: identity, kind: 'identity' }
  }
  if (from.nodeType === 'card_identity') {
    const subject = relation ? await subjectOfPrintings(db, await printingsOfIdentity(db, [from.id]), relation) : null
    return subject ? { subject, kind: 'entity' } : { subject: from.id, kind: 'identity' }
  }
  if (['game', 'series', 'set', 'artist', 'digital_asset'].includes(from.nodeType)) {
    throw new GraphError(`A ${from.nodeType} has no lineage; open it from a card or a Pokémon.`, { nodeId: from.id, status: 400 })
  }
  return { subject: from.id, kind: 'entity' }
}

/** The evolution line around some identities, as identity → pre-evolution identity pairs. */
async function evolutionPairs(db: Db, start: string[]): Promise<Array<[string, string]>> {
  const pairs = new Map<string, [string, string]>()
  const seen = new Set(start)
  let frontier = start
  for (let hop = 0; hop < FAMILY_DEPTH * 2 && frontier.length > 0; hop += 1) {
    const found = rows<{ s: string; t: string }>(
      await db.execute(sql`
        select source_node_id as s, target_node_id as t from graph_edges
        where relationship_type = 'EVOLUTION_OF'
          and (source_node_id in (${list(frontier)}) or target_node_id in (${list(frontier)}))
      `),
    )
    const next: string[] = []
    for (const { s, t } of found) {
      pairs.set(`${s}>${t}`, [s, t])
      for (const id of [s, t]) {
        if (!seen.has(id)) {
          seen.add(id)
          next.push(id)
        }
      }
    }
    frontier = next.slice(0, 64)
    if (seen.size > 120) break
  }
  return [...pairs.values()]
}

/** Stages from the evolves-from pairs: the base is 0, each evolution one more (longest line wins). */
export function stagesOf(ids: string[], evolvesFrom: Map<string, Set<string>>): Map<string, number> {
  const stage = new Map<string, number>()
  const visiting = new Set<string>()
  const walk = (id: string): number => {
    const known = stage.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) return 0
    visiting.add(id)
    let value = 0
    for (const parent of evolvesFrom.get(id) ?? []) value = Math.max(value, walk(parent) + 1)
    visiting.delete(id)
    stage.set(id, value)
    return value
  }
  for (const id of ids) walk(id)
  return stage
}

/**
 * The family of a subject: map the evolution line of its identities to subjects (Dark Charmeleon
 * shows Charmeleon), keep the members connected to the subject, and order them by stage.
 */
async function familyOf(
  db: Db,
  subjectId: string,
  identityIds: string[],
  relation: string | null,
  kind: 'entity' | 'identity',
): Promise<{ members: Array<{ id: string; stage: number; evolvesFrom: string[] }> }> {
  const pairs = await evolutionPairs(db, identityIds)
  if (pairs.length === 0) return { members: [] }
  const identities = [...new Set(pairs.flat())]
  const subjectOfIdentity = new Map<string, string>()
  if (kind === 'entity' && relation) {
    const mapped = rows<{ identity: string; subject: string; n: number | string }>(
      await db.execute(sql`
        select pi.target_node_id as identity, ps.target_node_id as subject, count(*)::int as n
        from graph_edges pi
        join graph_edges ps on ps.source_node_id = pi.source_node_id and ps.relationship_type = ${relation}
        where pi.relationship_type = 'PRINTING_OF' and pi.target_node_id in (${list(identities)})
        group by pi.target_node_id, ps.target_node_id
        order by n desc, subject
      `),
    )
    for (const row of mapped) if (!subjectOfIdentity.has(row.identity)) subjectOfIdentity.set(row.identity, row.subject)
  } else {
    for (const id of identities) subjectOfIdentity.set(id, id)
  }
  const evolvesFrom = new Map<string, Set<string>>()
  const neighbours = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    neighbours.set(a, (neighbours.get(a) ?? new Set()).add(b))
    neighbours.set(b, (neighbours.get(b) ?? new Set()).add(a))
  }
  for (const [s, t] of pairs) {
    const from = subjectOfIdentity.get(s)
    const to = subjectOfIdentity.get(t)
    if (!from || !to || from === to) continue
    evolvesFrom.set(from, (evolvesFrom.get(from) ?? new Set()).add(to))
    link(from, to)
  }
  if (!neighbours.has(subjectId)) return { members: [] }
  // Only the line the subject belongs to (and close to it): breadth-first from the subject.
  const distance = new Map<string, number>([[subjectId, 0]])
  let frontier = [subjectId]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      for (const other of neighbours.get(id) ?? []) {
        if (distance.has(other)) continue
        distance.set(other, (distance.get(id) ?? 0) + 1)
        if ((distance.get(other) ?? 0) < FAMILY_DEPTH * 2) next.push(other)
      }
    }
    frontier = next
  }
  const ids = [...distance.keys()].sort((a, b) => (distance.get(a) ?? 0) - (distance.get(b) ?? 0) || a.localeCompare(b)).slice(0, FAMILY_LIMIT)
  const kept = new Set(ids)
  const stages = stagesOf(ids, evolvesFrom)
  return {
    members: ids.map((id) => ({
      id,
      stage: stages.get(id) ?? 0,
      evolvesFrom: [...(evolvesFrom.get(id) ?? [])].filter((p) => kept.has(p)).sort(),
    })),
  }
}

export interface LineageOptions {
  /**
   * The adapter's subject relation (Pokémon: `SAME_POKEMON`); null when the game has none. A
   * function receives the slug of the point's game (an app that serves several games).
   */
  subjectRelation?: string | null | ((gameSlug: string) => string | null)
  /** Printings returned at most. Default `LINEAGE_PRINTING_LIMIT`. */
  limit?: number
}

export async function getLineage(db: Db, nodeId: string, options: LineageOptions = {}): Promise<Lineage> {
  if (!parseNodeId(nodeId)) throw new GraphError(`Malformed node id: ${nodeId}`, { nodeId, status: 400 })
  const limit = Math.max(1, Math.min(2000, Math.floor(options.limit ?? LINEAGE_PRINTING_LIMIT)))
  const [from] = await loadNodes(db, [nodeId])
  if (!from) throw new GraphError(`Node not found: ${nodeId}`, { nodeId, status: 404 })
  let relation: string | null = null
  if (typeof options.subjectRelation === 'function') {
    const slug = rows<{ slug: string }>(await db.execute(sql`select slug from tcg_games where id = ${from.gameId}`))[0]?.slug
    relation = slug ? options.subjectRelation(slug) : null
  } else relation = options.subjectRelation ?? null
  const { subject: subjectId, kind } = await resolveSubject(db, from, relation)

  // Every printing that shows the subject (or is a printing of the card), oldest first.
  const printingRel = kind === 'entity' ? relation : 'PRINTING_OF'
  const printingRows = rows<{ id: string }>(
    await db.execute(
      printingRel
        ? sql`
            select e.source_node_id as id from graph_edges e
            join graph_nodes n on n.id = e.source_node_id
            where e.target_node_id = ${subjectId} and e.relationship_type = ${printingRel} and n.node_type = 'card_printing'
            order by coalesce(n.metadata->>'releaseDate', '9999'), n.id`
        : sql`
            select e.source_node_id as id from graph_edges e
            join graph_nodes n on n.id = e.source_node_id
            where e.target_node_id = ${subjectId} and n.node_type = 'card_printing'
            order by coalesce(n.metadata->>'releaseDate', '9999'), n.id`,
    ),
  )
  const allPrintingIds = [...new Set(printingRows.map((r) => r.id))]
  const printingIds = allPrintingIds.slice(0, limit)

  // Their sets, series, artists and identities.
  const around = printingIds.length
    ? rows<{ s: string; t: string; rel: string }>(
        await db.execute(sql`
          select source_node_id as s, target_node_id as t, relationship_type as rel from graph_edges
          where source_node_id in (${list(printingIds)})
            and relationship_type in ('BELONGS_TO', 'ILLUSTRATED_BY', 'PRINTING_OF')
        `),
      )
    : []
  const setOf = new Map<string, string>()
  const artistOf = new Map<string, string>()
  const identityIds = new Set<string>()
  for (const r of around) {
    if (r.rel === 'BELONGS_TO') setOf.set(r.s, r.t)
    else if (r.rel === 'ILLUSTRATED_BY') artistOf.set(r.s, r.t)
    else identityIds.add(r.t)
  }
  if (kind === 'identity') identityIds.add(subjectId)
  const setIds = [...new Set(setOf.values())]
  const seriesRows = setIds.length
    ? rows<{ s: string; t: string }>(
        await db.execute(sql`
          select source_node_id as s, target_node_id as t from graph_edges
          where relationship_type = 'PART_OF' and source_node_id in (${list(setIds)})
            and target_node_id like 'series:%'
        `),
      )
    : []
  const seriesOf = new Map(seriesRows.map((r) => [r.s, r.t]))

  const family = await familyOf(db, subjectId, [...identityIds], relation, kind)
  const nodeIds = new Set<string>([subjectId, ...printingIds, ...setIds, ...seriesOf.values(), ...artistOf.values(), ...family.members.map((m) => m.id)])
  const nodes = await loadNodes(db, [...nodeIds])
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const subject = byId.get(subjectId)
  if (!subject) throw new GraphError(`Node not found: ${subjectId}`, { nodeId: subjectId, status: 404 })

  const printings = printingIds.map((id) => byId.get(id)).filter((n): n is GraphNode => Boolean(n))

  // Eras: series → sets → printings; newest first at every level.
  const bySet = new Map<string, GraphNode[]>()
  for (const p of printings) {
    const set = setOf.get(p.id)
    if (!set) continue
    bySet.set(set, [...(bySet.get(set) ?? []), p])
  }
  const sets: LineageSet[] = [...bySet.entries()]
    .map(([id, ps]) => {
      const set = byId.get(id)
      if (!set) return null
      const sorted = ps.slice().sort(byNumber)
      return { set, printings: sorted, year: yearOf(set.metadata.releaseDate) ?? yearOf(sorted[0]?.metadata.releaseDate) }
    })
    .filter((s): s is LineageSet => s !== null)
    .sort((a, b) => release(b.set).localeCompare(release(a.set)) || a.set.label.localeCompare(b.set.label))
  const eras: LineageEra[] = []
  for (const entry of sets) {
    const seriesId = seriesOf.get(entry.set.id) ?? null
    const last = eras.at(-1)
    if (last && (last.series?.id ?? null) === seriesId) last.sets.push(entry)
    else eras.push({ series: seriesId ? (byId.get(seriesId) ?? null) : null, sets: [entry] })
  }

  // Artists: most prolific first, with the years they drew it.
  const artistStats = new Map<string, { count: number; first: number | null; last: number | null }>()
  for (const p of printings) {
    const artist = artistOf.get(p.id)
    if (!artist) continue
    const year = yearOf(p.metadata.releaseDate)
    const stat = artistStats.get(artist) ?? { count: 0, first: null, last: null }
    stat.count += 1
    if (year !== null) {
      stat.first = stat.first === null ? year : Math.min(stat.first, year)
      stat.last = stat.last === null ? year : Math.max(stat.last, year)
    }
    artistStats.set(artist, stat)
  }
  const artists: LineageArtist[] = [...artistStats.entries()]
    .map(([id, s]) => ({ node: byId.get(id), count: s.count, firstYear: s.first, lastYear: s.last }))
    .filter((a): a is LineageArtist => Boolean(a.node))
    .sort((a, b) => b.count - a.count || (a.firstYear ?? 9999) - (b.firstYear ?? 9999) || a.node.label.localeCompare(b.node.label))

  // Real edges among the points: the structure, the artists, the reprints, the debut.
  const ids = [...nodeIds]
  const real = rows<EdgeRow>(
    await db.execute(sql`
      select id, source_node_id, target_node_id, relationship_type, weight, direction, metadata from graph_edges
      where source_node_id in (${list(ids)}) and target_node_id in (${list(ids)})
        and relationship_type in ('BELONGS_TO', 'PART_OF', 'ILLUSTRATED_BY', 'REPRINT_OF')
      order by id
    `),
  ).map(toGraphEdge)
  const edges = [...real]
  const first = printings[0] ?? null
  if (first && printingRel) {
    edges.push({
      id: `lineage:${first.id}>${printingRel}>${subjectId}`,
      sourceNodeId: first.id,
      targetNodeId: subjectId,
      relationshipType: printingRel,
      weight: 1,
      direction: 'directed',
      metadata: { debut: true },
    })
  }
  const members: LineageMember[] = []
  for (const m of family.members) {
    const node = byId.get(m.id)
    if (!node) continue
    members.push({ node, stage: m.stage, evolvesFrom: m.evolvesFrom })
    for (const parent of m.evolvesFrom) {
      edges.push({
        id: `lineage:${m.id}>EVOLUTION_OF>${parent}`,
        sourceNodeId: m.id,
        targetNodeId: parent,
        relationshipType: 'EVOLUTION_OF',
        weight: 0.9,
        direction: 'directed',
        metadata: {},
      })
    }
  }
  members.sort((a, b) => a.stage - b.stage || a.node.label.localeCompare(b.node.label))

  const latest = printings.length
    ? printings.reduce((best, p) => (release(p) !== '9999' && release(p) >= release(best) ? p : best), printings[0]!)
    : null

  return {
    from,
    subject,
    family: members,
    printings,
    eras,
    artists,
    first,
    latest,
    printingCount: allPrintingIds.length,
    setCount: sets.length,
    truncated: allPrintingIds.length > printingIds.length,
    edges,
  }
}
