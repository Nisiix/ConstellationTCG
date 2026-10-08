/**
 * FilterService — resolves filter definitions (universal + adapter) for a game and computes
 * their available values from the catalog. Results are cached per game for a few minutes:
 * filter values only change when ingestion runs.
 */
import type { AdapterRegistry } from '@constellation/adapters'
import { sql, type Db } from '@constellation/database'
import type { FilterDefinition, FilterSource, FilterValue } from '@constellation/domain'
import { UNIVERSAL_FILTERS } from './universal'

interface CacheEntry {
  expiresAt: number
  definitions: FilterDefinition[]
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result) return (result as { rows: T[] }).rows
  return []
}

export interface FilterServiceOptions {
  ttlMs?: number
  /** Maximum values computed per filter. */
  maxValues?: number
}

export class FilterService {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly ttlMs: number
  private readonly maxValues: number

  constructor(
    private readonly db: Db,
    private readonly registry: AdapterRegistry,
    options: FilterServiceOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? 5 * 60_000
    this.maxValues = options.maxValues ?? 300
  }

  invalidate(gameSlug?: string): void {
    if (gameSlug) this.cache.delete(gameSlug)
    else this.cache.clear()
  }

  /** Static definitions without computed values (universal + adapter). */
  definitionsFor(gameSlug: string): FilterDefinition[] {
    const adapter = this.registry.bySlug(gameSlug)
    const gameFilters = adapter?.definition().filters ?? []
    return [...UNIVERSAL_FILTERS, ...gameFilters].map((f) => ({ ...f }))
  }

  async definitions(gameSlug: string): Promise<FilterDefinition[]> {
    const cached = this.cache.get(gameSlug)
    if (cached && cached.expiresAt > Date.now()) return cached.definitions

    const game = rows<{ id: string; slug: string; name: string }>(
      await this.db.execute(sql`select id, slug, name from tcg_games where slug = ${gameSlug}`),
    )[0]
    const games = rows<{ slug: string; name: string }>(
      await this.db.execute(sql`select slug, name from tcg_games where active order by name`),
    )

    const definitions: FilterDefinition[] = []
    for (const def of this.definitionsFor(gameSlug)) {
      if (def.id === 'tcg') {
        definitions.push({ ...def, values: games.map((g) => ({ value: g.slug, label: g.name })) })
        continue
      }
      if (def.id === 'relationship' && game) {
        definitions.push({ ...def, values: await this.relationshipValues(game.id) })
        continue
      }
      if (!def.source || !game) {
        definitions.push(def)
        continue
      }
      definitions.push({ ...def, ...(await this.computeValues(game.id, def.source)) })
    }
    this.cache.set(gameSlug, { expiresAt: Date.now() + this.ttlMs, definitions })
    return definitions
  }

  private async relationshipValues(gameId: string): Promise<FilterValue[]> {
    const result = await this.db.execute(sql`
      select e.relationship_type as value, count(*)::int as count
      from graph_edges e join graph_nodes n on n.id = e.source_node_id
      where n.game_id = ${gameId}
      group by e.relationship_type order by count desc
    `)
    return rows<{ value: string; count: number | string }>(result).map((r) => ({
      value: r.value,
      label: labelize(r.value),
      count: Number(r.count),
    }))
  }

  private async computeValues(gameId: string, source: FilterSource): Promise<Partial<FilterDefinition>> {
    const limit = this.maxValues
    switch (source.kind) {
      case 'column': {
        const column = sql.identifier(source.column)
        const result = await this.db.execute(sql`
          select p.${column} as value, count(*)::int as count
          from card_printings p join tcg_sets s on s.id = p.set_id
          where s.game_id = ${gameId} and p.${column} is not null
          group by p.${column} order by count desc, value asc limit ${limit}
        `)
        return { values: toValues(rows(result)) }
      }
      case 'attribute': {
        if (source.numeric) {
          const result = await this.db.execute(sql`
            select min((p.attributes->>${source.path})::numeric)::float as min,
                   max((p.attributes->>${source.path})::numeric)::float as max
            from card_printings p join tcg_sets s on s.id = p.set_id
            where s.game_id = ${gameId} and jsonb_typeof(p.attributes->${source.path}) = 'number'
          `)
          const row = rows<{ min: number | string | null; max: number | string | null }>(result)[0]
          if (!row || row.min === null || row.max === null) return {}
          return { min: Number(row.min), max: Number(row.max) }
        }
        const valueExpr = source.array
          ? sql`jsonb_array_elements_text(p.attributes->${source.path})`
          : sql`p.attributes->>${source.path}`
        const result = await this.db.execute(sql`
          select v as value, count(*)::int as count from (
            select ${valueExpr} as v
            from card_printings p join tcg_sets s on s.id = p.set_id
            where s.game_id = ${gameId} and p.attributes ? ${source.path}
          ) t where v is not null
          group by v order by count desc, value asc limit ${limit}
        `)
        return { values: toValues(rows(result)) }
      }
      case 'entity': {
        const relationFilter = source.relation ? sql`and pe.relation = ${source.relation}` : sql``
        const result = await this.db.execute(sql`
          select e.key as value, e.name as label, count(*)::int as count
          from printing_entities pe
          join entities e on e.id = pe.entity_id
          where e.game_id = ${gameId} and e.kind = ${source.entityKind} ${relationFilter}
          group by e.key, e.name order by count desc, label asc limit ${limit}
        `)
        return { values: toValues(rows(result)) }
      }
      case 'relation': {
        if (source.relation === 'set') {
          const result = await this.db.execute(sql`
            select s.id as value, s.name as label, s.series_id as parent, count(p.id)::int as count
            from tcg_sets s left join card_printings p on p.set_id = s.id
            where s.game_id = ${gameId}
            group by s.id, s.name, s.series_id, s.release_date order by s.release_date asc nulls last, s.name asc
          `)
          return { values: toValues(rows(result)) }
        }
        if (source.relation === 'series') {
          const result = await this.db.execute(sql`
            select r.id as value, r.name as label, count(p.id)::int as count
            from tcg_series r
            left join tcg_sets s on s.series_id = r.id
            left join card_printings p on p.set_id = s.id
            where r.game_id = ${gameId}
            group by r.id, r.name, r.release_date order by r.release_date asc nulls last, r.name asc
          `)
          return { values: toValues(rows(result)) }
        }
        const result = await this.db.execute(sql`
          select a.id as value, a.name as label, count(*)::int as count
          from artists a
          join card_printings p on p.artist_id = a.id
          join tcg_sets s on s.id = p.set_id
          where s.game_id = ${gameId}
          group by a.id, a.name order by count desc, label asc limit ${limit}
        `)
        return { values: toValues(rows(result)) }
      }
    }
  }
}

interface ValueRow {
  value: string | number | null
  label?: string | null
  count?: number | string | null
  parent?: string | null
}

function toValues(list: ValueRow[]): FilterValue[] {
  const out: FilterValue[] = []
  for (const r of list) {
    if (r.value === null || r.value === undefined) continue
    const value = String(r.value)
    const entry: FilterValue & { parent?: string } = {
      value,
      label: r.label ? String(r.label) : labelize(value),
      count: r.count === null || r.count === undefined ? undefined : Number(r.count),
    }
    if (r.parent) entry.parent = r.parent
    out.push(entry)
  }
  return out
}

/** "HAS_TYPE" → "Has type", "stage1" → "Stage1", "pokemon" → "Pokemon". */
export function labelize(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
