import { create } from 'zustand'
import type { ViewMode } from '@/lib/url'

export interface UiStoreState {
  paletteOpen: boolean
  filtersOpen: boolean
  hoveredNodeId: string | null
  /** Preferred view when the URL does not say. */
  view: ViewMode
  reducedMotion: boolean
  /** null until detected on the client. */
  webgl: boolean | null
  tooltip: { nodeId: string; x: number; y: number } | null

  setPaletteOpen(open: boolean): void
  togglePalette(): void
  setFiltersOpen(open: boolean): void
  toggleFilters(): void
  setHovered(nodeId: string | null, position?: { x: number; y: number }): void
  setView(view: ViewMode): void
  setCapabilities(caps: { reducedMotion: boolean; webgl: boolean }): void
}

export const useUiStore = create<UiStoreState>((set) => ({
  paletteOpen: false,
  filtersOpen: false,
  hoveredNodeId: null,
  view: '3d',
  reducedMotion: false,
  webgl: null,
  tooltip: null,

  setPaletteOpen: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setFiltersOpen: (open) => set({ filtersOpen: open }),
  toggleFilters: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
  setHovered: (nodeId, position) =>
    set({
      hoveredNodeId: nodeId,
      tooltip: nodeId && position ? { nodeId, x: position.x, y: position.y } : null,
    }),
  setView: (view) => set({ view }),
  setCapabilities: ({ reducedMotion, webgl }) =>
    set({ reducedMotion, webgl, view: webgl ? '3d' : 'list' }),
}))
