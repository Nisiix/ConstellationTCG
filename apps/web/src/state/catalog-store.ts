import type { FilterDefinition, NodeType, ResolvedTheme, TCGTheme, ThemeMode } from '@constellation/domain'
import { DEFAULT_THEME, resolveTheme } from '@constellation/ui'
import { create } from 'zustand'
import type { GameSummary } from '@/lib/api'
import { DEFAULT_GAME } from '@/lib/url'

export type PlaceholderImages = Partial<Record<NodeType, string>>

export interface CatalogStoreState {
  game: string
  games: GameSummary[]
  /** The selected game's palette (brand colors + both modes), as declared by its adapter. */
  theme: TCGTheme
  /** Dark or light. Set from the visitor's preference on the client. */
  mode: ThemeMode
  /** `theme` flattened for `mode`: what every component actually paints with. */
  resolved: ResolvedTheme
  /** Stand-in images per node type for the selected game (e.g. the classic Pokémon logo). */
  placeholders: PlaceholderImages
  filters: FilterDefinition[]
  filtersStatus: 'idle' | 'loading' | 'ready' | 'error'
  /** Raw filter values keyed by filter id (the same shape as the URL `f.<id>` params). */
  selection: Record<string, string>

  setGame(game: string): void
  setGames(games: GameSummary[]): void
  setMode(mode: ThemeMode): void
  setFilters(filters: FilterDefinition[]): void
  setFiltersStatus(status: CatalogStoreState['filtersStatus']): void
  setSelection(selection: Record<string, string>): void
  setFilterValue(id: string, value: string | null): void
  clearSelection(): void
}

function summaryFor(games: GameSummary[], game: string): GameSummary | undefined {
  return games.find((g) => g.slug === game)
}

function derive(games: GameSummary[], game: string, mode: ThemeMode) {
  const summary = summaryFor(games, game)
  const theme = summary?.theme ?? DEFAULT_THEME
  return { theme, resolved: resolveTheme(theme, mode), placeholders: summary?.placeholderImages ?? {} }
}

export const useCatalogStore = create<CatalogStoreState>((set) => ({
  game: DEFAULT_GAME,
  games: [],
  theme: DEFAULT_THEME,
  mode: 'dark',
  resolved: resolveTheme(DEFAULT_THEME, 'dark'),
  placeholders: {},
  filters: [],
  filtersStatus: 'idle',
  selection: {},

  setGame: (game) => set((state) => ({ game, ...derive(state.games, game, state.mode) })),
  setGames: (games) => set((state) => ({ games, ...derive(games, state.game, state.mode) })),
  setMode: (mode) =>
    set((state) => (state.mode === mode ? {} : { mode, ...derive(state.games, state.game, mode) })),
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
