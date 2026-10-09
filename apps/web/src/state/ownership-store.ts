import { create } from 'zustand'

/**
 * Ownership overlay state (My Constellation). The graph never changes; owned nodes are only
 * rendered differently. Fed by the account store from `/api/ownership`.
 */
export interface OwnershipStoreState {
  connected: boolean
  ownedNodeIds: Set<string>
  lastSyncedAt?: string
  /** "Only mine": everything that is not owned (or the focus) steps back in the sky. */
  focusOnOwned: boolean
  setOwned(nodeIds: Iterable<string>, syncedAt?: string): void
  setFocusOnOwned(on: boolean): void
  toggleFocusOnOwned(): void
  disconnect(): void
}

export const useOwnershipStore = create<OwnershipStoreState>((set) => ({
  connected: false,
  ownedNodeIds: new Set(),
  focusOnOwned: false,
  setOwned: (nodeIds, syncedAt) =>
    set({
      connected: true,
      ownedNodeIds: new Set(nodeIds),
      lastSyncedAt: syncedAt ?? new Date().toISOString(),
    }),
  setFocusOnOwned: (on) => set({ focusOnOwned: on }),
  toggleFocusOnOwned: () => set((s) => ({ focusOnOwned: !s.focusOnOwned })),
  disconnect: () =>
    set({
      connected: false,
      ownedNodeIds: new Set(),
      lastSyncedAt: undefined,
      focusOnOwned: false,
    }),
}))
