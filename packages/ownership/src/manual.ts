/**
 * Declared ownership: a person says "I own this printing". Stored like any other digital asset
 * (platform `manual`) so the overlay, the counts and the panel treat every source alike, with a
 * resolution of confidence 1 to the printing itself.
 */
import {
  and,
  cardPrintings,
  digitalAssets,
  digitalOwnership,
  eq,
  sql,
  type Db,
} from '@constellation/database'
import { ValidationError, parseNodeId } from '@constellation/domain'
import { recordResolution } from '@constellation/resolver'
import { MANUAL_PLATFORM } from './providers/manual'

export interface DeclareInput {
  ownerId: string
  /** A `card_printing:<uuid>` node id or a bare printing uuid. */
  printing: string
  quantity?: number
}

function printingIdFrom(value: string): string {
  const parsed = parseNodeId(value.trim())
  if (parsed) {
    if (parsed.type !== 'card_printing')
      throw new ValidationError('Only printings can be declared as owned', { nodeId: value })
    return parsed.entityId
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())) {
    throw new ValidationError('Expected a printing node id', { value })
  }
  return value.trim()
}

/** Declare a printing as owned; idempotent (declaring twice updates the quantity). */
export async function declareOwnership(
  db: Db,
  input: DeclareInput,
): Promise<{ assetId: string; printingId: string }> {
  const printingId = printingIdFrom(input.printing)
  const [printing] = await db
    .select({
      id: cardPrintings.id,
      externalId: cardPrintings.externalId,
      imageFront: cardPrintings.imageFront,
    })
    .from(cardPrintings)
    .where(eq(cardPrintings.id, printingId))
    .limit(1)
  if (!printing) throw new ValidationError('Printing not found', { status: 404, printingId })
  const quantity = Math.max(1, Math.min(999, Math.trunc(input.quantity ?? 1)))

  const [asset] = await db
    .insert(digitalAssets)
    .values({
      platform: MANUAL_PLATFORM,
      chain: MANUAL_PLATFORM,
      contractAddress: MANUAL_PLATFORM,
      tokenId: printing.id,
      name: printing.externalId,
      imageUri: printing.imageFront,
      attributes: {},
      rawMetadata: { printingId: printing.id },
    })
    .onConflictDoUpdate({
      target: [
        digitalAssets.platform,
        digitalAssets.chain,
        digitalAssets.contractAddress,
        digitalAssets.tokenId,
      ],
      set: { imageUri: printing.imageFront, updatedAt: sql`now()` },
    })
    .returning({ id: digitalAssets.id })
  if (!asset) throw new ValidationError('Could not store the declared card', { status: 500 })

  await db
    .insert(digitalOwnership)
    .values({
      assetId: asset.id,
      ownerId: input.ownerId,
      walletAddress: MANUAL_PLATFORM,
      walletId: null,
      quantity,
      source: MANUAL_PLATFORM,
    })
    .onConflictDoUpdate({
      target: [digitalOwnership.assetId, digitalOwnership.ownerId, digitalOwnership.walletAddress],
      set: { quantity, lastSeen: sql`now()` },
    })
  await recordResolution(db, asset.id, {
    status: 'resolved',
    confidence: 1,
    printingId: printing.id,
    candidates: [{ printingId: printing.id, confidence: 1, reasons: ['declared'] }],
  })
  return { assetId: asset.id, printingId: printing.id }
}

/** Take a declared printing back off the list. Returns whether anything was removed. */
export async function releaseOwnership(
  db: Db,
  input: { ownerId: string; printing: string },
): Promise<boolean> {
  const printingId = printingIdFrom(input.printing)
  const [asset] = await db
    .select({ id: digitalAssets.id })
    .from(digitalAssets)
    .where(and(eq(digitalAssets.platform, MANUAL_PLATFORM), eq(digitalAssets.tokenId, printingId)))
    .limit(1)
  if (!asset) return false
  const deleted = await db
    .delete(digitalOwnership)
    .where(
      and(
        eq(digitalOwnership.assetId, asset.id),
        eq(digitalOwnership.ownerId, input.ownerId),
        eq(digitalOwnership.source, MANUAL_PLATFORM),
      ),
    )
    .returning({ id: digitalOwnership.id })
  return deleted.length > 0
}
