import { create } from 'zustand'

/**
 * Ownership overlay state (My Constellation). The graph never changes; owned nodes are only
 * rendered differently. Wallet / platform connections arrive in a later milestone.
 */
export interface OwnershipStoreState {
  connected: boolean
  ownedNodeIds: Set<string>
  lastSyncedAt?: string
  setOwned(nodeIds: Iterable<string>, syncedAt?: string): void
  disconnect(): void
}

export const useOwnershipStore = create<OwnershipStoreState>((set) => ({
  connected: false,
  ownedNodeIds: new Set(),
  setOwned: (nodeIds, syncedAt) =>
    set({ connected: true, ownedNodeIds: new Set(nodeIds), lastSyncedAt: syncedAt ?? new Date().toISOString() }),
  disconnect: () => set({ connected: false, ownedNodeIds: new Set(), lastSyncedAt: undefined }),
}))
