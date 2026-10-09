import {
  cardPrintings,
  digitalOwnership,
  eq,
  walletSyncRuns,
  wallets,
  type Database,
} from '@constellation/database'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { createSeededDatabase } from '@constellation/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { declareOwnership, releaseOwnership } from '../manual'
import { ownershipSnapshot } from '../owned'
import { createProviderRegistry } from '../registry'
import { syncWallet } from '../sync'
import type { OwnershipProvider, ProviderAsset } from '../types'
import { evmAddressFromPublicKey, signEvmMessage } from '../verify'
import { linkWallet, listWallets, removeWallet, verifyWallet } from '../wallets'

let database: Database
const OWNER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const key = secp256k1.utils.randomSecretKey()
const address = evmAddressFromPublicKey(secp256k1.getPublicKey(key, false))

function asset(
  tokenId: string,
  name: string,
  attributes: Record<string, unknown> = {},
): ProviderAsset {
  return {
    platform: 'evm',
    chain: 'polygon',
    contractAddress: '0xcards',
    tokenId,
    name,
    metadataUri: null,
    imageUri: null,
    attributes,
    rawMetadata: { name },
    quantity: 1,
  }
}

/** A fake EVM provider whose holdings the test controls. */
let holdings: ProviderAsset[] = []
const fakeEvm: OwnershipProvider = {
  id: 'evm',
  kind: 'evm',
  label: 'Fake EVM',
  chains: [{ id: 'polygon', label: 'Polygon', source: 'test' }],
  availability: () => ({ available: true }),
  normalizeAddress: (a) => a.trim().toLowerCase(),
  fetchAssets: async () => holdings,
}
const registry = createProviderRegistry({ providers: [fakeEvm] })

beforeAll(async () => {
  database = (await createSeededDatabase()).database
})

afterAll(async () => {
  await database.close()
})

describe('wallet linking', () => {
  it('links an address, issues a challenge and verifies the signature', async () => {
    const linked = await linkWallet(database.db, registry, {
      ownerId: OWNER,
      provider: 'evm',
      chain: 'polygon',
      address: address.toUpperCase().replace('0X', '0x'),
      label: 'Main',
    })
    expect(linked.wallet.address).toBe(address)
    expect(linked.wallet.verifiedAt).toBeNull()
    expect(linked.challenge?.message).toContain(address)

    // A wrong signature is refused, the right one verifies.
    const wrongKey = secp256k1.utils.randomSecretKey()
    await expect(
      verifyWallet(database.db, registry, {
        ownerId: OWNER,
        walletId: linked.wallet.id,
        signature: signEvmMessage(linked.challenge!.message, wrongKey),
      }),
    ).rejects.toThrow(/does not match/)
    const verified = await verifyWallet(database.db, registry, {
      ownerId: OWNER,
      walletId: linked.wallet.id,
      signature: signEvmMessage(linked.challenge!.message, key),
    })
    expect(verified.verifiedAt).not.toBeNull()

    // Linking again is idempotent and needs no new challenge.
    const again = await linkWallet(database.db, registry, {
      ownerId: OWNER,
      provider: 'evm',
      chain: 'polygon',
      address,
    })
    expect(again.wallet.id).toBe(linked.wallet.id)
    expect(again.challenge).toBeNull()
    expect(await listWallets(database.db, OWNER)).toHaveLength(1)
    expect(await listWallets(database.db, OTHER)).toHaveLength(0)
  })

  it('rejects unknown chains, unknown providers and declared cards as wallets', async () => {
    await expect(
      linkWallet(database.db, registry, {
        ownerId: OWNER,
        provider: 'evm',
        chain: 'mars',
        address,
      }),
    ).rejects.toThrow(/not available/)
    await expect(
      linkWallet(database.db, registry, {
        ownerId: OWNER,
        provider: 'nope',
        chain: 'polygon',
        address,
      }),
    ).rejects.toThrow(/Unknown provider/)
    const full = createProviderRegistry({ env: {} })
    await expect(
      linkWallet(database.db, full, {
        ownerId: OWNER,
        provider: 'manual',
        chain: 'manual',
        address: 'x',
      }),
    ).rejects.toThrow(/do not use a wallet/)
  })

  it('refuses an expired challenge', async () => {
    const other = evmAddressFromPublicKey(
      secp256k1.getPublicKey(secp256k1.utils.randomSecretKey(), false),
    )
    const linked = await linkWallet(
      database.db,
      registry,
      { ownerId: OWNER, provider: 'evm', chain: 'polygon', address: other },
      new Date('2026-01-01T00:00:00Z'),
    )
    await expect(
      verifyWallet(
        database.db,
        registry,
        {
          ownerId: OWNER,
          walletId: linked.wallet.id,
          signature: signEvmMessage(linked.challenge!.message, key),
        },
        new Date('2026-01-02T00:00:00Z'),
      ),
    ).rejects.toThrow(/expired/)
    expect(await removeWallet(database.db, OWNER, linked.wallet.id)).toBe(true)
    expect(await removeWallet(database.db, OTHER, linked.wallet.id)).toBe(false)
  })
})

describe('wallet sync → ownership overlay', () => {
  it('stores, resolves and highlights what the address holds; releases what it no longer holds', async () => {
    const [wallet] = await listWallets(database.db, OWNER)
    if (!wallet) throw new Error('wallet missing')
    holdings = [
      asset('4', 'Charizard', { Set: 'Base Set', 'Card Number': '4/102', Language: 'en' }),
      asset('58', 'Pikachu #58', { 'TCGdex ID': 'base1-58' }),
      asset('999', 'Zoroark'),
      asset('1000', 'Charizard'),
    ]
    const summary = await syncWallet(database.db, registry, {
      ownerId: OWNER,
      walletId: wallet.id,
      game: 'pokemon',
    })
    expect(summary).toMatchObject({
      walletId: wallet.id,
      assetsSeen: 4,
      assetsResolved: 2,
      assetsAmbiguous: 1,
      assetsUnresolved: 1,
      released: 0,
    })

    const snapshot = await ownershipSnapshot(database.db, OWNER)
    expect(snapshot.counts).toEqual({ total: 4, resolved: 2, ambiguous: 1, unresolved: 1 })
    const charizard = snapshot.assets.find((a) => a.tokenId === '4')
    expect(charizard).toMatchObject({
      status: 'resolved',
      printingName: 'Charizard',
      setName: 'Base Set',
      collectorNumber: '4',
    })
    expect(charizard?.printingNodeId).toMatch(/^card_printing:/)
    expect(snapshot.nodeIds.some((id) => id.startsWith('card_identity:'))).toBe(true)
    expect(snapshot.nodeIds).toHaveLength(4) // 2 printings + 2 identities
    expect(snapshot.assets.find((a) => a.tokenId === '1000')?.status).toBe('ambiguous')
    expect(snapshot.assets.find((a) => a.tokenId === '999')?.status).toBe('unresolved')

    const [row] = await database.db.select().from(wallets).where(eq(wallets.id, wallet.id))
    expect(row).toMatchObject({ syncStatus: 'idle', assetCount: 4 })
    expect(row?.lastSyncedAt).not.toBeNull()
    const runs = await database.db
      .select()
      .from(walletSyncRuns)
      .where(eq(walletSyncRuns.walletId, wallet.id))
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ status: 'succeeded', assetsSeen: 4, assetsResolved: 2 })

    // The address sold two cards: their ownership rows go, the rest stay.
    holdings = holdings.slice(0, 2)
    const second = await syncWallet(database.db, registry, {
      ownerId: OWNER,
      walletId: wallet.id,
      game: 'pokemon',
    })
    expect(second).toMatchObject({ assetsSeen: 2, released: 2 })
    const after = await ownershipSnapshot(database.db, OWNER)
    expect(after.counts.total).toBe(2)
    expect(after.nodeIds).toHaveLength(4)
    // Other accounts see nothing.
    expect((await ownershipSnapshot(database.db, OTHER)).counts.total).toBe(0)
  })

  it('records a failed run and the wallet error, then recovers', async () => {
    const [wallet] = await listWallets(database.db, OWNER)
    if (!wallet) throw new Error('wallet missing')
    const failing = createProviderRegistry({
      providers: [
        { ...fakeEvm, fetchAssets: async () => Promise.reject(new Error('explorer down')) },
      ],
    })
    await expect(
      syncWallet(database.db, failing, { ownerId: OWNER, walletId: wallet.id, game: 'pokemon' }),
    ).rejects.toThrow(/explorer down/)
    const [row] = await database.db.select().from(wallets).where(eq(wallets.id, wallet.id))
    expect(row).toMatchObject({ syncStatus: 'error', syncError: 'explorer down' })
    const runs = await database.db
      .select()
      .from(walletSyncRuns)
      .where(eq(walletSyncRuns.walletId, wallet.id))
    expect(runs.filter((r) => r.status === 'failed')).toHaveLength(1)
    await expect(
      syncWallet(database.db, registry, { ownerId: OTHER, walletId: wallet.id, game: 'pokemon' }),
    ).rejects.toThrow(/not found/)
  })

  it('removing the wallet removes its ownership rows', async () => {
    const [wallet] = await listWallets(database.db, OWNER)
    if (!wallet) throw new Error('wallet missing')
    await removeWallet(database.db, OWNER, wallet.id)
    const left = await database.db
      .select()
      .from(digitalOwnership)
      .where(eq(digitalOwnership.ownerId, OWNER))
    expect(left).toHaveLength(0)
  })
})

describe('declared cards', () => {
  it('declares a printing as owned (confidence 1), lists it and releases it', async () => {
    const [printing] = await database.db
      .select({ id: cardPrintings.id })
      .from(cardPrintings)
      .limit(1)
    if (!printing) throw new Error('no printing')
    const declared = await declareOwnership(database.db, {
      ownerId: OWNER,
      printing: `card_printing:${printing.id}`,
      quantity: 2,
    })
    expect(declared.printingId).toBe(printing.id)
    // Idempotent.
    await declareOwnership(database.db, { ownerId: OWNER, printing: printing.id })
    const snapshot = await ownershipSnapshot(database.db, OWNER)
    expect(snapshot.counts).toEqual({ total: 1, resolved: 1, ambiguous: 0, unresolved: 0 })
    expect(snapshot.assets[0]).toMatchObject({
      platform: 'manual',
      source: 'manual',
      confidence: 1,
      printingId: printing.id,
      quantity: 1,
    })
    expect(snapshot.nodeIds).toContain(`card_printing:${printing.id}`)

    await expect(
      declareOwnership(database.db, { ownerId: OWNER, printing: 'set:abc' }),
    ).rejects.toThrow(/Only printings/)
    await expect(
      declareOwnership(database.db, {
        ownerId: OWNER,
        printing: '00000000-0000-4000-8000-00000000dead',
      }),
    ).rejects.toThrow(/not found/)

    expect(await releaseOwnership(database.db, { ownerId: OWNER, printing: printing.id })).toBe(
      true,
    )
    expect(await releaseOwnership(database.db, { ownerId: OWNER, printing: printing.id })).toBe(
      false,
    )
    expect((await ownershipSnapshot(database.db, OWNER)).counts.total).toBe(0)
  })
})
