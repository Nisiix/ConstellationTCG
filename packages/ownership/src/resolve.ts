/**
 * The owner's word on an ambiguous asset: which printing it really is. The choice is recorded as
 * a resolution of confidence 1 with a dedicated reason, and later syncs leave it alone. Resetting
 * runs the automatic resolver again.
 */
import {
  and,
  assetResolutionCandidates,
  cardPrintings,
  digitalAssets,
  digitalOwnership,
  eq,
  sql,
  type Db,
} from '@constellation/database'
import { ValidationError, type ResolverCandidate } from '@constellation/domain'
import { recordResolution, resolveAsset } from '@constellation/resolver'
import { signalsFromAsset } from './signals'

export const OWNER_CHOICE_REASON = 'chosen by owner'

async function ownedAsset(db: Db, ownerId: string, assetId: string) {
  const [row] = await db
    .select({ asset: digitalAssets })
    .from(digitalOwnership)
    .innerJoin(digitalAssets, eq(digitalAssets.id, digitalOwnership.assetId))
    .where(and(eq(digitalOwnership.assetId, assetId), eq(digitalOwnership.ownerId, ownerId)))
    .limit(1)
  if (!row) throw new ValidationError('Asset not found among your cards', { status: 404, assetId })
  return row.asset
}

/** Pin an asset to a printing (`printingId`), or hand it back to the automatic resolver (`null`). */
export async function chooseResolution(
  db: Db,
  input: { ownerId: string; assetId: string; printingId: string | null; game: string },
): Promise<{ status: 'resolved' | 'ambiguous' | 'unresolved'; printingId: string | null }> {
  const asset = await ownedAsset(db, input.ownerId, input.assetId)
  if (input.printingId === null) {
    const result = await resolveAsset(
      db,
      signalsFromAsset(
        {
          platform: asset.platform,
          chain: asset.chain ?? '',
          contractAddress: asset.contractAddress ?? '',
          tokenId: asset.tokenId ?? '',
          name: asset.name,
          metadataUri: asset.metadataUri,
          imageUri: asset.imageUri,
          attributes: (asset.attributes ?? {}) as Record<string, unknown>,
          rawMetadata: (asset.rawMetadata ?? {}) as Record<string, unknown>,
          quantity: 1,
        },
        input.game,
      ),
    )
    await recordResolution(db, asset.id, result)
    return {
      status: result.status,
      printingId: result.status === 'resolved' ? result.printingId : null,
    }
  }
  const [printing] = await db
    .select({ id: cardPrintings.id })
    .from(cardPrintings)
    .where(eq(cardPrintings.id, input.printingId))
    .limit(1)
  if (!printing)
    throw new ValidationError('Printing not found', { status: 404, printingId: input.printingId })
  const existing = await db
    .select()
    .from(assetResolutionCandidates)
    .where(eq(assetResolutionCandidates.assetId, asset.id))
  const previous = existing.find((c) => c.printingId === printing.id)
  const chosen: ResolverCandidate = {
    printingId: printing.id,
    confidence: 1,
    reasons: [
      ...((previous?.reasons as string[] | undefined) ?? []).filter(
        (r) => r !== OWNER_CHOICE_REASON,
      ),
      OWNER_CHOICE_REASON,
    ],
  }
  const others: ResolverCandidate[] = existing
    .filter((c) => c.printingId !== printing.id)
    .map((c) => ({
      printingId: c.printingId,
      confidence: c.confidence,
      reasons: ((c.reasons as string[] | undefined) ?? []).filter((r) => r !== OWNER_CHOICE_REASON),
    }))
  await recordResolution(db, asset.id, {
    status: 'resolved',
    confidence: 1,
    printingId: printing.id,
    candidates: [chosen, ...others],
  })
  return { status: 'resolved', printingId: printing.id }
}

/** True when the owner pinned this asset to a printing: syncs must not re-resolve it. */
export async function hasOwnerChoice(db: Db, assetId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: assetResolutionCandidates.id })
    .from(assetResolutionCandidates)
    .where(
      and(
        eq(assetResolutionCandidates.assetId, assetId),
        eq(assetResolutionCandidates.status, 'resolved'),
        sql`${assetResolutionCandidates.reasons} @> ${JSON.stringify([OWNER_CHOICE_REASON])}::jsonb`,
      ),
    )
    .limit(1)
  return Boolean(row)
}
