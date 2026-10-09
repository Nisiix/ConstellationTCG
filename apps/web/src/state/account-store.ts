import { create } from 'zustand'
import {
  fetchAccount,
  fetchOwnership,
  fetchWallets,
  type AccountUser,
  type Challenge,
  type OwnedAsset,
  type OwnershipSnapshot,
  type ProviderDescriptor,
  type WalletRecord,
} from '@/lib/account-api'
import { useOwnershipStore } from './ownership-store'

export type AccountStatus = 'unknown' | 'unconfigured' | 'anonymous' | 'signed-in'

/**
 * The account side of My Constellation: who is signed in, their wallets (with the challenges
 * still to sign) and what they own. The graph never changes; `useOwnershipStore` only receives
 * the node ids to paint in the ownership color.
 */
export interface AccountStoreState {
  status: AccountStatus
  user: AccountUser | null
  providers: ProviderDescriptor[]
  wallets: WalletRecord[]
  challenges: Record<string, Challenge>
  assets: OwnedAsset[]
  counts: OwnershipSnapshot['counts'] | null
  /** Last failure of a refresh, as a sentence. */
  error: string | null

  refreshAccount(): Promise<AccountStatus>
  refreshWallets(): Promise<void>
  refreshOwnership(): Promise<void>
  signedOut(): void
}

const EMPTY_COUNTS: OwnershipSnapshot['counts'] = {
  total: 0,
  resolved: 0,
  ambiguous: 0,
  unresolved: 0,
}

export const useAccountStore = create<AccountStoreState>((set, get) => ({
  status: 'unknown',
  user: null,
  providers: [],
  wallets: [],
  challenges: {},
  assets: [],
  counts: null,
  error: null,

  async refreshAccount() {
    try {
      const account = await fetchAccount()
      const status: AccountStatus = !account.configured
        ? 'unconfigured'
        : account.user
          ? 'signed-in'
          : 'anonymous'
      set({ status, user: account.user, providers: account.providers, error: null })
      if (status === 'signed-in') {
        await Promise.all([get().refreshWallets(), get().refreshOwnership()])
      } else {
        set({ wallets: [], challenges: {}, assets: [], counts: null })
        useOwnershipStore.getState().disconnect()
      }
      return status
    } catch (error) {
      set({ error: (error as Error).message || 'Could not reach your account.' })
      return get().status
    }
  },

  async refreshWallets() {
    try {
      const res = await fetchWallets()
      set({ wallets: res.wallets, challenges: res.challenges, error: null })
    } catch (error) {
      set({ error: (error as Error).message || 'Could not load your wallets.' })
    }
  },

  async refreshOwnership() {
    try {
      const snapshot = await fetchOwnership()
      set({ assets: snapshot.assets, counts: snapshot.counts ?? EMPTY_COUNTS, error: null })
      useOwnershipStore.getState().setOwned(snapshot.nodeIds, snapshot.syncedAt)
    } catch (error) {
      set({ error: (error as Error).message || 'Could not load your cards.' })
    }
  },

  signedOut() {
    set({
      status: 'anonymous',
      user: null,
      wallets: [],
      challenges: {},
      assets: [],
      counts: null,
      error: null,
    })
    useOwnershipStore.getState().disconnect()
  },
}))
