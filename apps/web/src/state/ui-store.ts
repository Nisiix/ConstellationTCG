import { create } from 'zustand'
import type { ViewMode } from '@/lib/url'

export interface UiStoreState {
  filtersOpen: boolean
  helpOpen: boolean
  /** The My Constellation panel (account, wallets, owned cards). */
  accountOpen: boolean
  hoveredNodeId: string | null
  /**
   * Points singled out from the interface (a group or a row in the focus panel under the
   * pointer): the scene dims everything else so the relationship stands out. `null` = none.
   */
  highlight: Set<string> | null
  /** Preferred view when the URL does not say. */
  view: ViewMode
  reducedMotion: boolean
  /** null until detected on the client. */
  webgl: boolean | null
  tooltip: { nodeId: string; x: number; y: number } | null
  /** The first-visit welcome card is on screen (the universe focus panel steps aside). */
  welcomeVisible: boolean

  setWelcomeVisible(visible: boolean): void
  setFiltersOpen(open: boolean): void
  toggleFilters(): void
  setHelpOpen(open: boolean): void
  toggleHelp(): void
  setAccountOpen(open: boolean): void
  toggleAccount(): void
  setHovered(nodeId: string | null, position?: { x: number; y: number }): void
  setHighlight(nodeIds: Iterable<string> | null): void
  setView(view: ViewMode): void
  setCapabilities(caps: { reducedMotion: boolean; webgl: boolean }): void
}

export const useUiStore = create<UiStoreState>((set) => ({
  filtersOpen: false,
  helpOpen: false,
  accountOpen: false,
  hoveredNodeId: null,
  highlight: null,
  view: '3d',
  reducedMotion: false,
  webgl: null,
  tooltip: null,
  welcomeVisible: false,

  setWelcomeVisible: (visible) => set({ welcomeVisible: visible }),
  setFiltersOpen: (open) => set({ filtersOpen: open }),
  toggleFilters: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
  setHelpOpen: (open) => set({ helpOpen: open }),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
  setAccountOpen: (open) => set({ accountOpen: open }),
  toggleAccount: () => set((s) => ({ accountOpen: !s.accountOpen })),
  setHovered: (nodeId, position) =>
    set({
      hoveredNodeId: nodeId,
      tooltip: nodeId && position ? { nodeId, x: position.x, y: position.y } : null,
    }),
  setHighlight: (nodeIds) => set({ highlight: nodeIds ? new Set(nodeIds) : null }),
  setView: (view) => set({ view }),
  setCapabilities: ({ reducedMotion, webgl }) => set({ reducedMotion, webgl, view: webgl ? '3d' : 'list' }),
}))
