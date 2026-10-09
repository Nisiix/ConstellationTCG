/**
 * What an account owns, as the explorer needs it: the graph node ids to highlight (printings and
 * their identities) and a list of assets with their resolution status. Reads only; the graph is
 * never changed by ownership.
 */
import { sql, type Db } from '@constellation/database'
import { makeNodeId } from '@constellation/domain'

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
}

export interface OwnershipSnapshot {
  nodeIds: string[]
  assets: OwnedAsset[]
  counts: { total: number; resolved: number; ambiguous: number; unresolved: number }
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
      best.status, best.confidence, best.printing_id, p.identity_id, i.canonical_name as printing_name, s.name as set_name, p.collector_number
    from digital_ownership o
    join digital_assets a on a.id = o.asset_id
    left join lateral (
      select c.status, c.confidence, case when c.status = 'resolved' then c.printing_id end as printing_id
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
  for (const row of rows<Row>(result)) {
    const status: OwnedAsset['status'] =
      row.status === 'resolved'
        ? 'resolved'
        : row.status === 'ambiguous'
          ? 'ambiguous'
          : 'unresolved'
    counts.total += 1
    counts[status] += 1
    let printingNodeId: string | null = null
    if (status === 'resolved' && row.printing_id) {
      printingNodeId = makeNodeId('card_printing', row.printing_id)
      nodeIds.add(printingNodeId)
      if (row.identity_id) nodeIds.add(makeNodeId('card_identity', row.identity_id))
    }
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
    })
  }
  return { nodeIds: [...nodeIds], assets, counts }
}
