/**
 * Synchronise one wallet: read what the address holds, store the assets, resolve each one to a
 * printing, and release what the address no longer holds. Every run is recorded in
 * `wallet_sync_runs`; the wallet row carries the last status so the interface can show it.
 */
import {
  and,
  digitalAssets,
  digitalOwnership,
  eq,
  inArray,
  sql,
  walletSyncRuns,
  wallets,
  type Db,
} from '@constellation/database'
import { ProviderError } from '@constellation/domain'
import { recordResolution, resolveAsset } from '@constellation/resolver'
import type { ProviderRegistry } from './registry'
import { hasOwnerChoice } from './resolve'
import { signalsFromAsset } from './signals'
import type { FetchAssetsOptions, ProviderAsset, SyncSummary } from './types'
import { getWallet } from './wallets'

export interface SyncWalletInput {
  ownerId: string
  walletId: string
  /** The game whose catalog the assets are matched against. */
  game: string
  fetch?: FetchAssetsOptions
}

export async function syncWallet(
  db: Db,
  registry: ProviderRegistry,
  input: SyncWalletInput,
): Promise<SyncSummary> {
  const wallet = await getWallet(db, input.ownerId, input.walletId)
  if (!wallet)
    throw new ProviderError('Wallet not found', { status: 404, walletId: input.walletId })
  if (!wallet.verifiedAt)
    throw new ProviderError('Verify the wallet before synchronising it', {
      status: 409,
      walletId: wallet.id,
    })
  const provider = registry.require(wallet.provider)
  const availability = provider.availability()
  if (!availability.available)
    throw new ProviderError(availability.reason ?? 'Provider unavailable', {
      status: 503,
      provider: provider.id,
    })

  const [run] = await db
    .insert(walletSyncRuns)
    .values({ walletId: wallet.id })
    .returning({ id: walletSyncRuns.id })
  await db
    .update(wallets)
    .set({ syncStatus: 'syncing', syncError: null, updatedAt: sql`now()` })
    .where(eq(wallets.id, wallet.id))

  try {
    const assets = await provider.fetchAssets(wallet.address, wallet.chain, input.fetch)
    const summary = await storeAssets(
      db,
      {
        ownerId: wallet.ownerId,
        walletId: wallet.id,
        walletAddress: wallet.address,
        game: input.game,
        source: provider.id,
      },
      assets,
    )
    if (run) {
      await db
        .update(walletSyncRuns)
        .set({
          finishedAt: sql`now()`,
          status: 'succeeded',
          assetsSeen: summary.assetsSeen,
          assetsResolved: summary.assetsResolved,
          assetsAmbiguous: summary.assetsAmbiguous,
          assetsUnresolved: summary.assetsUnresolved,
        })
        .where(eq(walletSyncRuns.id, run.id))
    }
    await db
      .update(wallets)
      .set({
        syncStatus: 'idle',
        syncError: null,
        lastSyncedAt: sql`now()`,
        assetCount: summary.assetsSeen,
        updatedAt: sql`now()`,
      })
      .where(eq(wallets.id, wallet.id))
    return summary
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (run)
      await db
        .update(walletSyncRuns)
        .set({ finishedAt: sql`now()`, status: 'failed', errorMessage: message })
        .where(eq(walletSyncRuns.id, run.id))
    await db
      .update(wallets)
      .set({ syncStatus: 'error', syncError: message, updatedAt: sql`now()` })
      .where(eq(wallets.id, wallet.id))
    throw error
  }
}

export interface StoreAssetsScope {
  ownerId: string
  walletId: string | null
  walletAddress: string | null
  game: string
  /** `digital_ownership.source`: the provider id. */
  source: string
}

/**
 * Upsert the assets and the ownership rows for a scope (one wallet), resolve each asset against the
 * catalog and remove the ownership rows for assets the scope no longer holds.
 */
export async function storeAssets(
  db: Db,
  scope: StoreAssetsScope,
  assets: ProviderAsset[],
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    walletId: scope.walletId ?? '',
    assetsSeen: 0,
    assetsResolved: 0,
    assetsAmbiguous: 0,
    assetsUnresolved: 0,
    released: 0,
  }
  const seenAssetIds: string[] = []
  const seenKeys = new Set<string>()

  for (const asset of assets) {
    const key = `${asset.platform}|${asset.chain}|${asset.contractAddress}|${asset.tokenId}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    summary.assetsSeen += 1

    const [stored] = await db
      .insert(digitalAssets)
      .values({
        platform: asset.platform,
        chain: asset.chain,
        contractAddress: asset.contractAddress,
        tokenId: asset.tokenId,
        name: asset.name,
        metadataUri: asset.metadataUri,
        imageUri: asset.imageUri,
        attributes: asset.attributes as never,
        rawMetadata: asset.rawMetadata as never,
      })
      .onConflictDoUpdate({
        target: [
          digitalAssets.platform,
          digitalAssets.chain,
          digitalAssets.contractAddress,
          digitalAssets.tokenId,
        ],
        set: {
          name: asset.name,
          metadataUri: asset.metadataUri,
          imageUri: asset.imageUri,
          attributes: asset.attributes as never,
          rawMetadata: asset.rawMetadata as never,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: digitalAssets.id })
    if (!stored) continue
    seenAssetIds.push(stored.id)

    await db
      .insert(digitalOwnership)
      .values({
        assetId: stored.id,
        ownerId: scope.ownerId,
        walletAddress: scope.walletAddress,
        walletId: scope.walletId,
        quantity: asset.quantity,
        source: scope.source,
      })
      .onConflictDoUpdate({
        target: [
          digitalOwnership.assetId,
          digitalOwnership.ownerId,
          digitalOwnership.walletAddress,
        ],
        set: {
          quantity: asset.quantity,
          walletId: scope.walletId,
          lastSeen: sql`now()`,
          source: scope.source,
        },
      })

    // A printing the owner chose by hand stays; everything else is resolved afresh.
    if (await hasOwnerChoice(db, stored.id)) {
      summary.assetsResolved += 1
      continue
    }
    const result = await resolveAsset(db, signalsFromAsset(asset, scope.game))
    await recordResolution(db, stored.id, result)
    if (result.status === 'resolved') summary.assetsResolved += 1
    else if (result.status === 'ambiguous') summary.assetsAmbiguous += 1
    else summary.assetsUnresolved += 1
  }

  // Release what this scope no longer holds.
  const scopeFilter = scope.walletId
    ? eq(digitalOwnership.walletId, scope.walletId)
    : and(eq(digitalOwnership.ownerId, scope.ownerId), eq(digitalOwnership.source, scope.source))
  const stale = await db
    .delete(digitalOwnership)
    .where(
      seenAssetIds.length
        ? and(scopeFilter, sql`${digitalOwnership.assetId} not in ${seenAssetIds}` as never)
        : scopeFilter,
    )
    .returning({ id: digitalOwnership.id })
  summary.released = stale.length
  return summary
}

/** Ownership rows (with their assets) of an account whose asset ids are in `ids`; test helper. */
export async function ownershipRowsFor(db: Db, ownerId: string, ids: string[]) {
  if (ids.length === 0) return []
  return db
    .select()
    .from(digitalOwnership)
    .where(and(eq(digitalOwnership.ownerId, ownerId), inArray(digitalOwnership.assetId, ids)))
}
