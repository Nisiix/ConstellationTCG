import { create } from 'zustand'
import type { ViewMode } from '@/lib/url'

export interface UiStoreState {
  paletteOpen: boolean
  filtersOpen: boolean
  helpOpen: boolean
  hoveredNodeId: string | null
  /** Preferred view when the URL does not say. */
  view: ViewMode
  reducedMotion: boolean
  /** null until detected on the client. */
  webgl: boolean | null
  tooltip: { nodeId: string; x: number; y: number } | null
  /** The first-visit welcome card is on screen (the universe focus panel steps aside). */
  welcomeVisible: boolean

  setWelcomeVisible(visible: boolean): void
  setPaletteOpen(open: boolean): void
  togglePalette(): void
  setFiltersOpen(open: boolean): void
  toggleFilters(): void
  setHelpOpen(open: boolean): void
  toggleHelp(): void
  setHovered(nodeId: string | null, position?: { x: number; y: number }): void
  setView(view: ViewMode): void
  setCapabilities(caps: { reducedMotion: boolean; webgl: boolean }): void
}

export const useUiStore = create<UiStoreState>((set) => ({
  paletteOpen: false,
  filtersOpen: false,
  helpOpen: false,
  hoveredNodeId: null,
  view: '3d',
  reducedMotion: false,
  webgl: null,
  tooltip: null,
  welcomeVisible: false,

  setWelcomeVisible: (visible) => set({ welcomeVisible: visible }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setFiltersOpen: (open) => set({ filtersOpen: open }),
  toggleFilters: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
  setHelpOpen: (open) => set({ helpOpen: open }),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
  setHovered: (nodeId, position) =>
    set({
      hoveredNodeId: nodeId,
      tooltip: nodeId && position ? { nodeId, x: position.x, y: position.y } : null,
    }),
  setView: (view) => set({ view }),
  setCapabilities: ({ reducedMotion, webgl }) => set({ reducedMotion, webgl, view: webgl ? '3d' : 'list' }),
}))
