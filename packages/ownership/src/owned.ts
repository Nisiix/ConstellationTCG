/**
 * What an account owns, as the explorer needs it: the graph node ids to highlight (printings and
 * their identities) and a list of assets with their resolution status. Reads only; the graph is
 * never changed by ownership.
 */
import { sql, type Db } from '@constellation/database'
import { makeNodeId } from '@constellation/domain'
import { OWNER_CHOICE_REASON } from './resolve'

export interface OwnedAsset {
  assetId: string
  platform: string
  chain: string | null
  contractAddress: string | null
  tokenId: string | null
  name: string | null
  imageUri: string | null
  quantity: number
  source: string
  walletId: string | null
  /** `resolved`, `ambiguous`, `unresolved` (no candidate at all is `unresolved`). */
  status: 'resolved' | 'ambiguous' | 'unresolved'
  confidence: number | null
  /** The matched printing (resolved only). */
  printingId: string | null
  printingNodeId: string | null
  printingName: string | null
  setName: string | null
  collectorNumber: string | null
  /** The owner pinned this asset to its printing by hand. */
  chosen: boolean
  /** Plausible printings of an ambiguous asset, best first, for the owner to pick from. */
  candidates: ResolutionCandidate[]
}

export interface ResolutionCandidate {
  printingId: string
  printingNodeId: string
  name: string
  setName: string | null
  collectorNumber: string | null
  confidence: number
}

export interface OwnershipStats {
  /** Owned printings (points in the ownership color). */
  ownedCards: number
  /** Distinct points connected to an owned card: sets, Pokémon, artists, cards… */
  connected: number
  /** Groups of owned cards that share a connection (same set, Pokémon, artist, card or reprint line). */
  constellations: number
}

export interface OwnershipSnapshot {
  nodeIds: string[]
  assets: OwnedAsset[]
  counts: { total: number; resolved: number; ambiguous: number; unresolved: number }
  stats: OwnershipStats
}

interface Row {
  asset_id: string
  platform: string
  chain: string | null
  contract_address: string | null
  token_id: string | null
  name: string | null
  image_uri: string | null
  quantity: number
  source: string
  wallet_id: string | null
  status: string | null
  confidence: number | null
  reasons: unknown
  printing_id: string | null
  identity_id: string | null
  printing_name: string | null
  set_name: string | null
  collector_number: string | null
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result)
    return (result as { rows: T[] }).rows
  return []
}

export async function ownershipSnapshot(
  db: Db,
  ownerId: string,
  limit = 1_000,
): Promise<OwnershipSnapshot> {
  const result = await db.execute(sql`
    select o.asset_id, a.platform, a.chain, a.contract_address, a.token_id, a.name, a.image_uri, o.quantity, o.source, o.wallet_id,
      best.status, best.confidence, best.reasons, best.printing_id, p.identity_id, i.canonical_name as printing_name, s.name as set_name, p.collector_number
    from digital_ownership o
    join digital_assets a on a.id = o.asset_id
    left join lateral (
      select c.status, c.confidence, c.reasons, case when c.status = 'resolved' then c.printing_id end as printing_id
      from asset_resolution_candidates c
      where c.asset_id = o.asset_id
      order by case c.status when 'resolved' then 0 when 'ambiguous' then 1 else 2 end, c.confidence desc
      limit 1
    ) best on true
    left join card_printings p on p.id = best.printing_id
    left join card_identities i on i.id = p.identity_id
    left join tcg_sets s on s.id = p.set_id
    where o.owner_id = ${ownerId}
    order by (best.status = 'resolved') desc nulls last, o.last_seen desc
    limit ${limit}
  `)
  const nodeIds = new Set<string>()
  const assets: OwnedAsset[] = []
  const counts = { total: 0, resolved: 0, ambiguous: 0, unresolved: 0 }
  const ambiguousIds: string[] = []
  for (const row of rows<Row>(result)) {
    const status: OwnedAsset['status'] =
      row.status === 'resolved'
        ? 'resolved'
        : row.status === 'ambiguous'
          ? 'ambiguous'
          : 'unresolved'
    counts.total += 1
    counts[status] += 1
    if (status === 'ambiguous') ambiguousIds.push(row.asset_id)
    let printingNodeId: string | null = null
    if (status === 'resolved' && row.printing_id) {
      printingNodeId = makeNodeId('card_printing', row.printing_id)
      nodeIds.add(printingNodeId)
      if (row.identity_id) nodeIds.add(makeNodeId('card_identity', row.identity_id))
    }
    const reasons = Array.isArray(row.reasons)
      ? (row.reasons as unknown[])
      : typeof row.reasons === 'string'
        ? (JSON.parse(row.reasons) as unknown[])
        : []
    assets.push({
      assetId: row.asset_id,
      platform: row.platform,
      chain: row.chain,
      contractAddress: row.contract_address,
      tokenId: row.token_id,
      name: row.name,
      imageUri: row.image_uri,
      quantity: Number(row.quantity),
      source: row.source,
      walletId: row.wallet_id,
      status,
      confidence: row.confidence === null ? null : Number(row.confidence),
      printingId: status === 'resolved' ? row.printing_id : null,
      printingNodeId,
      printingName: status === 'resolved' ? row.printing_name : null,
      setName: status === 'resolved' ? row.set_name : null,
      collectorNumber: status === 'resolved' ? row.collector_number : null,
      chosen: status === 'resolved' && reasons.includes(OWNER_CHOICE_REASON),
      candidates: [],
    })
  }
  if (ambiguousIds.length) {
    const byAsset = await candidatesFor(db, ambiguousIds)
    for (const asset of assets) asset.candidates = byAsset.get(asset.assetId) ?? []
  }
  const stats = await constellationStats(db, [...nodeIds])
  return { nodeIds: [...nodeIds], assets, counts, stats }
}

interface CandidateRow {
  asset_id: string
  printing_id: string
  confidence: number
  name: string
  set_name: string | null
  collector_number: string | null
}

const MAX_CANDIDATES = 5

async function candidatesFor(
  db: Db,
  assetIds: string[],
): Promise<Map<string, ResolutionCandidate[]>> {
  const result = await db.execute(sql`
    select c.asset_id, c.printing_id, c.confidence, i.canonical_name as name, s.name as set_name, p.collector_number
    from asset_resolution_candidates c
    join card_printings p on p.id = c.printing_id
    join card_identities i on i.id = p.identity_id
    join tcg_sets s on s.id = p.set_id
    where c.asset_id in (${sql.join(
      assetIds.map((id) => sql`${id}`),
      sql`, `,
    )})
    order by c.confidence desc
  `)
  const out = new Map<string, ResolutionCandidate[]>()
  for (const row of rows<CandidateRow>(result)) {
    const list = out.get(row.asset_id) ?? []
    if (list.length >= MAX_CANDIDATES) continue
    list.push({
      printingId: row.printing_id,
      printingNodeId: makeNodeId('card_printing', row.printing_id),
      name: row.name,
      setName: row.set_name,
      collectorNumber: row.collector_number,
      confidence: Number(row.confidence),
    })
    out.set(row.asset_id, list)
  }
  return out
}

/**
 * How the owned points sit in the sky: how many other points they touch, and how many groups they
 * form when owned cards sharing a connection (set, Pokémon, artist, card, reprint line) are joined.
 * Pure graph reading; the graph itself is untouched.
 */
export async function constellationStats(db: Db, ownedNodeIds: string[]): Promise<OwnershipStats> {
  const owned = new Set(ownedNodeIds)
  const ownedCards = ownedNodeIds.filter((id) => id.startsWith('card_printing:')).length
  if (ownedNodeIds.length === 0) return { ownedCards: 0, connected: 0, constellations: 0 }
  const list = sql.join(
    ownedNodeIds.map((id) => sql`${id}`),
    sql`, `,
  )
  const result = await db.execute(sql`
    select source_node_id, target_node_id from graph_edges
    where source_node_id in (${list}) or target_node_id in (${list})
  `)
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let root = x
    while (parent.get(root) !== undefined && parent.get(root) !== root)
      root = parent.get(root) as string
    if (!parent.has(root)) parent.set(root, root)
    // path compression
    let cur = x
    while (cur !== root) {
      const next = parent.get(cur) as string
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const id of ownedNodeIds) find(id)
  const connected = new Set<string>()
  const hubFirst = new Map<string, string>()
  for (const row of rows<{ source_node_id: string; target_node_id: string }>(result)) {
    const a = row.source_node_id
    const b = row.target_node_id
    const aOwned = owned.has(a)
    const bOwned = owned.has(b)
    if (aOwned && bOwned) {
      union(a, b)
      continue
    }
    const hub = aOwned ? b : a
    const mine = aOwned ? a : b
    connected.add(hub)
    const first = hubFirst.get(hub)
    if (first === undefined) hubFirst.set(hub, mine)
    else union(first, mine)
  }
  const roots = new Set<string>()
  for (const id of ownedNodeIds) if (id.startsWith('card_printing:')) roots.add(find(id))
  return { ownedCards, connected: connected.size, constellations: roots.size }
}
