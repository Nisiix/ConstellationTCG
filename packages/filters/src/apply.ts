/**
 * Apply a filter selection to the catalog: returns the set of `card_printing` node ids that match
 * every active printing-level filter, or `null` when no printing-level filter is active.
 * Graph-level filters (relationship, nodeType, graphDepth) are applied by the caller
 * on the neighborhood query.
 */
import { sql, type Db } from '@constellation/database'
import { makeNodeId, type FilterDefinition, type FilterSelection } from '@constellation/domain'
import { GRAPH_LEVEL_FILTER_IDS } from './universal'

type SQL = ReturnType<typeof sql>

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result) return (result as { rows: T[] }).rows
  return []
}

function list(values: string[]): SQL {
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )
}

function asStrings(value: FilterSelection[string]): string[] {
  if (value === undefined || value === null || typeof value === 'boolean') return []
  if (Array.isArray(value)) return value.map(String).filter((v) => v.length > 0)
  return String(value).length > 0 ? [String(value)] : []
}

function asRange(value: FilterSelection[string]): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [min, max] = value.map(Number)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return [min as number, max as number]
}

/** Build one SQL predicate per active filter. Exported for tests. */
export function predicateFor(def: FilterDefinition, value: FilterSelection[string]): SQL | null {
  const source = def.source
  if (!source || GRAPH_LEVEL_FILTER_IDS.has(def.id)) return null
  if (def.type === 'range') {
    const range = asRange(value)
    if (!range) return null
    if (source.kind === 'attribute') {
      return sql`(jsonb_typeof(p.attributes->${source.path}) = 'number' and (p.attributes->>${source.path})::numeric between ${range[0]} and ${range[1]})`
    }
    return null
  }
  const values = asStrings(value)
  if (values.length === 0) return null
  switch (source.kind) {
    case 'column':
      return sql`p.${sql.identifier(source.column)} in (${list(values)})`
    case 'attribute':
      if (source.array) {
        return sql`(p.attributes->${source.path}) ?| array[${list(values)}]::text[]`
      }
      return sql`p.attributes->>${source.path} in (${list(values)})`
    case 'entity': {
      const relation = source.relation ? sql`and pe.relation = ${source.relation}` : sql``
      return sql`exists (
        select 1 from printing_entities pe join entities e on e.id = pe.entity_id
        where pe.printing_id = p.id and e.kind = ${source.entityKind} ${relation} and e.key in (${list(values)})
      )`
    }
    case 'relation':
      if (source.relation === 'set') return sql`p.set_id in (${list(values)})`
      if (source.relation === 'series') return sql`s.series_id in (${list(values)})`
      return sql`p.artist_id in (${list(values)})`
  }
}

export async function matchingPrintingNodeIds(
  db: Db,
  gameId: string,
  definitions: FilterDefinition[],
  selection: FilterSelection,
): Promise<Set<string> | null> {
  const predicates: SQL[] = []
  for (const def of definitions) {
    const predicate = predicateFor(def, selection[def.id])
    if (predicate) predicates.push(predicate)
  }
  if (predicates.length === 0) return null
  const where = sql.join(predicates, sql` and `)
  const result = await db.execute(sql`
    select p.id from card_printings p join tcg_sets s on s.id = p.set_id
    where s.game_id = ${gameId} and ${where}
  `)
  return new Set(rows<{ id: string }>(result).map((r) => makeNodeId('card_printing', r.id)))
}

/** Parse `?filters=` style query values ("a,b" lists, "1..3" ranges, "true"/"false"). */
export function parseSelection(
  definitions: FilterDefinition[],
  raw: Record<string, string | string[] | undefined>,
): FilterSelection {
  const selection: FilterSelection = {}
  for (const def of definitions) {
    const value = raw[def.id]
    if (value === undefined) continue
    const text = Array.isArray(value) ? value.join(',') : value
    if (!text) continue
    switch (def.type) {
      case 'boolean':
        selection[def.id] = text === 'true' || text === '1'
        break
      case 'range': {
        const [a, b] = text.split('..')
        const min = Number(a)
        const max = Number(b ?? a)
        if (Number.isFinite(min) && Number.isFinite(max)) selection[def.id] = [min, max]
        break
      }
      case 'multi':
        selection[def.id] = text.split(',').map((v) => v.trim()).filter(Boolean)
        break
      case 'select':
        selection[def.id] = text.trim()
        break
    }
  }
  return selection
}
