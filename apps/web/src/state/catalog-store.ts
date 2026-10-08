import type { FilterDefinition, TCGTheme } from '@constellation/domain'
import { DEFAULT_THEME } from '@constellation/ui'
import { create } from 'zustand'
import type { GameSummary } from '@/lib/api'
import { DEFAULT_GAME } from '@/lib/url'

export interface CatalogStoreState {
  game: string
  games: GameSummary[]
  theme: TCGTheme
  filters: FilterDefinition[]
  filtersStatus: 'idle' | 'loading' | 'ready' | 'error'
  /** Raw filter values keyed by filter id (the same shape as the URL `f.<id>` params). */
  selection: Record<string, string>

  setGame(game: string): void
  setGames(games: GameSummary[]): void
  setFilters(filters: FilterDefinition[]): void
  setFiltersStatus(status: CatalogStoreState['filtersStatus']): void
  setSelection(selection: Record<string, string>): void
  setFilterValue(id: string, value: string | null): void
  clearSelection(): void
}

function themeFor(games: GameSummary[], game: string): TCGTheme {
  return games.find((g) => g.slug === game)?.theme ?? DEFAULT_THEME
}

export const useCatalogStore = create<CatalogStoreState>((set) => ({
  game: DEFAULT_GAME,
  games: [],
  theme: DEFAULT_THEME,
  filters: [],
  filtersStatus: 'idle',
  selection: {},

  setGame: (game) => set((state) => ({ game, theme: themeFor(state.games, game) })),
  setGames: (games) => set((state) => ({ games, theme: themeFor(games, state.game) })),
  setFilters: (filters) => set({ filters, filtersStatus: 'ready' }),
  setFiltersStatus: (filtersStatus) => set({ filtersStatus }),
  setSelection: (selection) => set({ selection }),
  setFilterValue: (id, value) =>
    set((state) => {
      const next = { ...state.selection }
      if (value === null || value === '') delete next[id]
      else next[id] = value
      return { selection: next }
    }),
  clearSelection: () => set({ selection: {} }),
}))

export function activeFilterCount(selection: Record<string, string>): number {
  return Object.values(selection).filter(Boolean).length
}
