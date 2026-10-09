/**
 * Wallet rows: link (with a signed challenge), list, remove. A wallet belongs to one account
 * (`ownerId`, the Supabase Auth user id); every query is scoped by it, so a person can never read
 * or touch another person's wallets even through the application connection.
 */
import { and, eq, wallets, type Db } from '@constellation/database'
import { ProviderError, ValidationError } from '@constellation/domain'
import type { ProviderRegistry } from './registry'
import type { WalletRecord } from './types'
import { challengeMessage, createChallenge, verifySignature, type Challenge } from './verify'

type WalletRow = typeof wallets.$inferSelect

export function toWalletRecord(row: WalletRow): WalletRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    provider: row.provider,
    chain: row.chain,
    address: row.address,
    label: row.label,
    verifiedAt: row.verifiedAt,
    syncStatus: row.syncStatus,
    syncError: row.syncError,
    lastSyncedAt: row.lastSyncedAt,
    assetCount: row.assetCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listWallets(db: Db, ownerId: string): Promise<WalletRecord[]> {
  const rows = await db.select().from(wallets).where(eq(wallets.ownerId, ownerId))
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toWalletRecord)
}

export async function getWallet(
  db: Db,
  ownerId: string,
  walletId: string,
): Promise<WalletRow | null> {
  const [row] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.ownerId, ownerId)))
    .limit(1)
  return row ?? null
}

export interface LinkWalletInput {
  ownerId: string
  provider: string
  chain: string
  address: string
  label?: string | null
}

export interface LinkedWallet {
  wallet: WalletRecord
  /** The text to sign; null when the wallet was already verified. */
  challenge: Challenge | null
}

/**
 * Register an address for an account and issue the challenge that proves control of it. Linking
 * the same address again (same provider and chain) returns the existing wallet with a fresh
 * challenge when it is still unverified.
 */
export async function linkWallet(
  db: Db,
  registry: ProviderRegistry,
  input: LinkWalletInput,
  now = new Date(),
): Promise<LinkedWallet> {
  const provider = registry.require(input.provider)
  if (provider.kind === 'manual')
    throw new ValidationError('Declared cards do not use a wallet', { provider: input.provider })
  if (!provider.chains.some((c) => c.id === input.chain)) {
    throw new ValidationError(`Chain ${input.chain} is not available for ${provider.label}`, {
      provider: input.provider,
      chain: input.chain,
    })
  }
  const address = provider.normalizeAddress(input.address)
  const label = input.label?.trim().slice(0, 80) || null

  const [existing] = await db
    .select()
    .from(wallets)
    .where(
      and(
        eq(wallets.ownerId, input.ownerId),
        eq(wallets.provider, provider.id),
        eq(wallets.chain, input.chain),
        eq(wallets.address, address),
      ),
    )
    .limit(1)
  if (existing?.verifiedAt) return { wallet: toWalletRecord(existing), challenge: null }

  const challenge = createChallenge({ address, chain: input.chain, now })
  if (existing) {
    const [updated] = await db
      .update(wallets)
      .set({
        challengeNonce: challenge.nonce,
        challengeExpiresAt: challenge.expiresAt,
        label: label ?? existing.label,
        updatedAt: now.toISOString(),
      })
      .where(eq(wallets.id, existing.id))
      .returning()
    return { wallet: toWalletRecord(updated ?? existing), challenge }
  }
  const [created] = await db
    .insert(wallets)
    .values({
      ownerId: input.ownerId,
      provider: provider.id,
      chain: input.chain,
      address,
      label,
      challengeNonce: challenge.nonce,
      challengeExpiresAt: challenge.expiresAt,
    })
    .returning()
  if (!created) throw new ProviderError('Wallet could not be stored', { status: 500 })
  return { wallet: toWalletRecord(created), challenge }
}

/** Check the wallet's signature over its pending challenge; on success the wallet is verified. */
export async function verifyWallet(
  db: Db,
  registry: ProviderRegistry,
  input: { ownerId: string; walletId: string; signature: string },
  now = new Date(),
): Promise<WalletRecord> {
  const row = await getWallet(db, input.ownerId, input.walletId)
  if (!row) throw new ValidationError('Wallet not found', { status: 404, walletId: input.walletId })
  if (row.verifiedAt) return toWalletRecord(row)
  if (!row.challengeNonce || !row.challengeExpiresAt) {
    throw new ValidationError('No pending challenge for this wallet; link it again', {
      status: 409,
      walletId: row.id,
    })
  }
  if (new Date(row.challengeExpiresAt).getTime() < now.getTime()) {
    throw new ValidationError('The challenge expired; link the wallet again', {
      status: 409,
      walletId: row.id,
    })
  }
  const provider = registry.require(row.provider)
  const message = challengeMessage({
    address: row.address,
    chain: row.chain,
    nonce: row.challengeNonce,
    expiresAt: new Date(row.challengeExpiresAt).toISOString(),
  })
  const ok = verifySignature(provider.kind, message, input.signature, row.address)
  if (!ok)
    throw new ValidationError('The signature does not match this address', {
      status: 401,
      walletId: row.id,
    })
  const [updated] = await db
    .update(wallets)
    .set({
      verifiedAt: now.toISOString(),
      challengeNonce: null,
      challengeExpiresAt: null,
      updatedAt: now.toISOString(),
    })
    .where(eq(wallets.id, row.id))
    .returning()
  return toWalletRecord(updated ?? row)
}

/** The text a wallet owner still has to sign (rebuilt from the stored challenge). */
export function pendingChallenge(row: WalletRow): Challenge | null {
  if (row.verifiedAt || !row.challengeNonce || !row.challengeExpiresAt) return null
  const expiresAt = new Date(row.challengeExpiresAt).toISOString()
  return {
    nonce: row.challengeNonce,
    expiresAt,
    message: challengeMessage({
      address: row.address,
      chain: row.chain,
      nonce: row.challengeNonce,
      expiresAt,
    }),
  }
}

/** Pending challenges of an account's unverified wallets, by wallet id. */
export async function listWalletChallenges(
  db: Db,
  ownerId: string,
): Promise<Record<string, Challenge>> {
  const rows = await db.select().from(wallets).where(eq(wallets.ownerId, ownerId))
  const out: Record<string, Challenge> = {}
  for (const row of rows) {
    const challenge = pendingChallenge(row)
    if (challenge) out[row.id] = challenge
  }
  return out
}

/** Remove a wallet; its ownership rows and sync runs go with it (cascade). */
export async function removeWallet(db: Db, ownerId: string, walletId: string): Promise<boolean> {
  const deleted = await db
    .delete(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.ownerId, ownerId)))
    .returning({ id: wallets.id })
  return deleted.length > 0
}
